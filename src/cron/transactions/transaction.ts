import cron from "node-cron"
import consola from "consola"
import { progressCLI } from "../../plugins/global"
import Web3 from "web3"
import db from "../../db"
import format from "pg-format"
import dayjs from "dayjs"

// Interfaces
import { ITransactionBlock, IConvertedTransaction } from "../../types"

export default class Transaction {
	private progress
	private web3

	private cryptoNetwork: string = process.env.CRYPTO_NETWORK!

	private fromBlock: number = 0
	private maxBlock: number = 0
	private isProgress: boolean = true

	private transactions: null | IConvertedTransaction[] = null

	private readonly counterName: string = `transactions_${this.cryptoNetwork}`
	private readonly blocksPerRequest: number = 50

	constructor(PROVIDER_URL: string) {
		this.progress = progressCLI(`Transactions`)

		const provider = new Web3.providers.HttpProvider(PROVIDER_URL)

		// @ts-ignore
		this.web3 = new Web3(provider, null, {})
	}

	private async fetchMaxBlockNumber(): Promise<void> {
		await this.web3.eth
			.getBlockNumber()
			.then((value: number) => {
				this.maxBlock = value
			})
			.catch((error: object) => {
				consola.error(new Error("Failed to fetch max block number"))
				consola.info(error)
			})
	}

	private async fetchLastBlock(): Promise<void> {
		let counter: number | null = null

		await db
			.query(`SELECT * FROM counters where name = $1`, [this.counterName])
			.then((rows: any) => {
				if (rows.length) {
					counter = Number(rows[0].value)
				}
			})
			.catch((error: object) => {
				console.log(error)
				consola.error(new Error("Failed get events-counter from database"))
			})

		// Check counter and init from value
		if (counter) {
			this.fromBlock = counter

			this.progress.setTotal(this.maxBlock)
			this.progress.update(counter)
		} else {
			await db
				.query(`INSERT INTO counters (name, value) VALUES ($1, $2)`, [
					this.counterName,
					0
				])
				.catch((error: object) => {
					if (error) {
						consola.error(new Error("Failed to set events-counter to database"))
						consola.info(error)
					}
				})
		}
	}

	private prepareLogs(): void {
		consola.info(`Start collect transactions`)
		this.progress.start(0, 0)
	}

	private newCounter(): number {
		return this.fromBlock + this.blocksPerRequest + 1
	}

	private async updateCounter(blockNumber?: number): Promise<void> {
		if (!blockNumber) {
			blockNumber = this.newCounter()
		}

		if (blockNumber > this.fromBlock) {
			await db
				.query(`UPDATE counters set value = $1 where name = $2`, [
					this.newCounter(),
					this.counterName
				])
				.catch(() => {
					consola.error(
						new Error("Failed to update events-counter in database")
					)
				})
		}
	}

	private resetData(): void {
		this.transactions = null
	}

	private async fetchTransactions(): Promise<void> {
		const promises: any[] = []

		for (
			let blockNumber: number = 0;
			blockNumber <= this.blocksPerRequest;
			blockNumber++
		) {
			promises.push(
				this.fetchTransactionsPagination(this.fromBlock + blockNumber)
			)
		}

		await Promise.all(promises).catch(async (error: object) => {
			consola.error(
				new Error(
					`Failed to fetch blocks in range: ${this.fromBlock} - ${this
						.fromBlock + this.blocksPerRequest}`
				)
			)
			consola.info(error)

			// Sleep 1 second
			await new Promise(resolve => setTimeout(resolve, 1000))
		})

		this.sortTransactions()
	}

	private sortTransactions(): void {
		if (this.transactions?.length) {
			this.transactions.sort((a, b) => {
				return Number(a.block_number) - Number(b.block_number)
			})
		}
	}

	private async fetchTransactionsPagination(block: number): Promise<void> {
		await this.web3.eth
			.getBlock(`${block}`, true)
			// @ts-ignore
			.then((data: ITransactionBlock) => {
				if (Array.isArray(this.transactions)) {
					this.transactions = [
						...this.transactions,
						...this.convertTransactions(data)
					]
				} else {
					this.transactions = this.convertTransactions(data)
				}
			})
			.catch(error => {
				consola.error(new Error(`Failed to fetch transactions from Web3`))
				consola.info(error)
			})
	}

	private convertTransactions(
		block: ITransactionBlock
	): IConvertedTransaction[] {
		const convertedTransactions: IConvertedTransaction[] = []

		const timestampString: string = dayjs(
			new Date(block.timestamp * 1000)
		).format("YYYY-MM-DD HH:mm:ss")

		block.transactions.forEach(
			({ hash, blockNumber, from, to, value, input }) => {
				let convertedInput: string | null = null

				if (input && input?.length > 8) {
					convertedInput = input.slice(2, 10)
				}

				const isNotDuplicate: boolean =
					convertedTransactions.findIndex(tx => tx?.tx_hash === hash) === -1

				if (isNotDuplicate) {
					convertedTransactions.push({
						tx_hash: hash!,
						block_number: blockNumber!,
						timestamp: timestampString,
						address_from: from?.toLowerCase() || null,
						address_to: to?.toLowerCase() || null,
						value: value || null,
						input: convertedInput
					})
				}
			}
		)

		return convertedTransactions
	}

	private async setTransactionsToDB(): Promise<void> {
		if (Array.isArray(this.transactions) && this.transactions.length) {
			const query: string = `INSERT INTO transactions_${this.cryptoNetwork} (tx_hash, block_number, timestamp, address_from, address_to, value, input) VALUES %L`

			// Set every 1000 or less events to database
			for (
				let index: number = 0;
				index <= this.transactions.length;
				index += 1000
			) {
				const values: any[][] = []

				let iterationTransactions: any[]

				if (this.transactions.length >= 1000) {
					iterationTransactions = this.transactions.slice().splice(index, 1000)
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
						this.updateCounter()
					} else {
						consola.error(
							new Error("Failed to set multiply transactions in database")
						)
						consola.info(error)
						return
					}
				})
			}

			this.updateCounter()
		}
	}

	private async task() {
		await this.fetchLastBlock()

		if (this.fromBlock < this.maxBlock) {
			await this.fetchTransactions()

			// Checks
			const isArray: boolean = Array.isArray(this.transactions)
			const isArrayLength: boolean = !!this.transactions?.length

			const isReadyToSet: boolean = isArray && isArrayLength
			const isEmptyArray: boolean = isArray && !isArrayLength

			if (isReadyToSet) {
				await this.setTransactionsToDB()

				this.resetData()
			} else if (isEmptyArray) {
				await this.updateCounter(this.fromBlock + this.blocksPerRequest)
			}

			// Call new task
			this.task()
		} else if (this.isProgress) {
			this.isProgress = false
		}
	}

	public async startCollectTransactions(cronTime: number = 10) {
		await this.fetchMaxBlockNumber()

		this.prepareLogs()

		this.task()

		// Collect event automation
		cron.schedule(`${cronTime} * * * *`, async () => {
			if (!this.isProgress) {
				await this.fetchMaxBlockNumber()
				await this.fetchLastBlock()

				if (this.maxBlock > this.fromBlock) {
					this.task()
				}
			}
		})
	}
}
