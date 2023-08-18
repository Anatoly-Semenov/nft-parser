// Libs
import db from "../../db"
import consola from "consola"
import cron from "node-cron"
import Web3 from "web3"
import dayjs from "dayjs"
import format from "pg-format"

// Types
type TableSuffix = "log" | "receipt"
type TableName = "account_transaction_log" | "account_transaction_receipt"
type DataType = null | string[]
import { IConvertedTransaction, ITransaction } from "../../types"

// Lodash
import { cloneDeep } from "lodash"

export default class TransactionMissing {
	private provider: string
	private web3

	private transactions: null | IConvertedTransaction[] = null

	private data = {
		account_transaction_log: null as DataType,
		account_transaction_receipt: null as DataType
	}

	constructor(provider: string) {
		this.provider = provider

		// @ts-ignore
		this.web3 = new Web3(provider, null, {})
	}

	private async fetchNotCollectedTransactions(tableSuffix: TableSuffix) {
		const tableName: TableName = `account_transaction_${tableSuffix}`

		consola.info(`Start collect missing transactions from table ${tableName}`)

		await db
			.query(
				`SELECT DISTINCT transaction_hash from ${tableName} where created_at IS NULL`
			)
			.then((response: { transaction_hash: string }[]) => {
				this.data[tableName] = response.map(
					({ transaction_hash }) => transaction_hash
				)
			})
			.catch((error: object) => {
				console.log(error)
				consola.error(
					new Error(
						`Failed get not collected transactions from table ${tableName}`
					)
				)
			})
	}

	private async fetchTransactions(table: TableSuffix) {
		const tableName: TableName = `account_transaction_${table}`

		for (const tx_hash of this.data[tableName]!) {
			await this.web3.eth
				.getTransaction(tx_hash)
				// @ts-ignore
				.then(async (data: ITransaction) => {
					const transaction = await this.convertTransaction(data)

					if (Array.isArray(this.transactions)) {
						this.transactions = [...this.transactions, transaction]
					} else {
						this.transactions = [transaction]
					}
				})
				.catch(error => {
					consola.error(new Error(`Failed to fetch transactions from Web3`))
					consola.info(error)
				})
		}
	}

	private async convertTransaction(
		transaction: ITransaction
	): Promise<IConvertedTransaction> {
		const { hash, blockNumber, from, to, value, input } = transaction

		const block = await this.web3.eth.getBlock(Number(blockNumber))

		let timestampString: string | null = null

		if (block) {
			timestampString = dayjs(new Date(Number(block.timestamp) * 1000)).format(
				"YYYY-MM-DD HH:mm:ss"
			)
		}

		let convertedInput: string | null = null

		if (input && input?.length > 8) {
			convertedInput = input.slice(2, 10)
		}

		return {
			tx_hash: hash!,
			block_number: blockNumber!,
			timestamp: timestampString,
			address_from: from?.toLowerCase() || null,
			address_to: to?.toLowerCase() || null,
			value: value || null,
			input: convertedInput
		}
	}

	private async setTransactionsToDB(): Promise<void> {
		// todo: Сделать динамическую сеть
		const cryptoNetwork = "bsc"

		if (Array.isArray(this.transactions) && this.transactions.length) {
			const query: string = `INSERT INTO transactions_${cryptoNetwork} (tx_hash, block_number, timestamp, address_from, address_to, value, input) VALUES %L`

			// Set every 1000 or less events to database
			for (
				let index: number = 0;
				index <= this.transactions.length;
				index += 1000
			) {
				const values: any[][] = []

				let iterationTransactions: any[]

				if (this.transactions.length >= 1000) {
					iterationTransactions = cloneDeep(this.transactions).splice(
						index,
						1000
					)
				} else {
					iterationTransactions = this.transactions
				}

				// Prepare rows
				iterationTransactions.forEach(event => {
					values.push([
						event.tx_hash,
						event.block_number,
						event.timestamp,
						event.address_from,
						event.address_to,
						event.value,
						event.input
					])
				})

				await db.query(format(query, values)).catch((error: any) => {
					if (error?.constraint === "unique_tx_hash") {
						return
					} else {
						consola.error(
							new Error("Failed to set multiply transactions in database")
						)
						consola.info(error)
						return
					}
				})
			}
		}
	}

	private async collectTransactions() {
		await Promise.all([
			this.fetchNotCollectedTransactions("log"),
			this.fetchNotCollectedTransactions("receipt")
		]).catch(() => {
			consola.error(new Error("Failed fetch transactions"))
		})

		if (
			this.data.account_transaction_log?.length ||
			this.data.account_transaction_receipt?.length
		) {
			const fetchTransactionsPromises = []

			if (this.data.account_transaction_log?.length) {
				fetchTransactionsPromises.push(this.fetchTransactions("log"))
			}

			if (this.data.account_transaction_receipt?.length) {
				fetchTransactionsPromises.push(this.fetchTransactions("receipt"))
			}

			await Promise.all(fetchTransactionsPromises)

			await this.setTransactionsToDB()

			consola.success(`End of collect missing transactions`)

			this.resetData()
		}
	}

	private resetData(): void {
		this.data = {
			account_transaction_log: null,
			account_transaction_receipt: null
		}
	}

	public async start(cronTime = 10) {
		await this.collectTransactions()

		cron.schedule(`${cronTime} * * * *`, () => {
			this.collectTransactions()
		})
	}
}
