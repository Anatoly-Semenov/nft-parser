import db from "../../db"
import consola from "consola"

// Types
interface Transaction {
	ctid: string
	tx_hash: string
}

export default class TransactionDuplicatesClean {
	private counterName: string = `transactions_duplicates_${process.env.CRYPTO_NETWORK}`
	private tableName: string = `transactions_${process.env.CRYPTO_NETWORK}`

	private currentBlockNumber: number = 0
	private maxBlockNumber: number = 0

	private duplicatesCtidList: string[] = []

	private async getMaxBlockNumber(): Promise<void> {
		try {
			const response = await db.query(
				`SELECT MAX(block_number) FROM transactions_polygon`
			)

			this.maxBlockNumber = response?.[0]?.max || 0
		} catch (error) {
			console.log(error)
			consola.error(
				new Error(`Failed get max block number from table ${this.tableName}`)
			)
		}
	}

	private async getCurrentBlockNumber(): Promise<void> {
		try {
			const response = await db.query(
				`SELECT "value" FROM counters where name = $1`,
				[this.counterName]
			)

			const value = response?.[0]?.value || 0

			this.currentBlockNumber = Number(value)
		} catch (error) {
			console.log(error)
			consola.error(
				new Error("Failed get transaction duplicates counter from database")
			)
		}
	}

	private async updateCurrentBlockNumber(): Promise<void> {
		const newCounter = this.currentBlockNumber + 1

		if (newCounter <= this.maxBlockNumber) {
			await db
				.query(`UPDATE counters set value = $1 where name = $2`, [
					newCounter,
					this.counterName
				])
				.catch(() => {
					consola.error(
						new Error(
							"Failed to update transaction duplicates counter in database"
						)
					)
				})
		}
	}

	private findDuplicatesCtid(transactions: Transaction[]): string[] {
		const uniqTxHashArray: string[] = []

		const duplicateCtIds: string[] = []

		transactions.forEach(({ ctid, tx_hash }) => {
			if (uniqTxHashArray.includes(tx_hash)) {
				duplicateCtIds.push(ctid)
			} else {
				uniqTxHashArray.push(tx_hash)
			}
		})

		return duplicateCtIds
	}

	private async findDuplicates(): Promise<void> {
		try {
			const transactions = await db.query(
				`SELECT ctid, tx_hash FROM "${this.tableName}" WHERE block_number = '${this.currentBlockNumber}'`
			)

			this.duplicatesCtidList = this.findDuplicatesCtid(transactions)
		} catch (error) {
			console.log(error)
			consola.error(
				new Error("Failed get transaction duplicates counter from database")
			)
		}
	}

	private async deleteDuplicate(): Promise<void> {
		try {
			await db.query(`DELETE FROM $1 where ctid in ($2) `, [
				this.tableName,
				this.duplicatesCtidList.join(",")
			])
		} catch (error) {
			console.log(error)
			consola.error(
				new Error(
					`Failed to delete duplicated transactions with 'ctid' ${JSON.stringify(
						this.duplicatesCtidList
					)}`
				)
			)
		}
		this.duplicatesCtidList = []
	}

	private async task(): Promise<void> {
		const currentBlockNumberOld: number = this.currentBlockNumber

		await this.getCurrentBlockNumber()

		if (currentBlockNumberOld !== this.currentBlockNumber) {
			await this.getMaxBlockNumber()

			await this.findDuplicates()

			if (this.duplicatesCtidList.length) await this.deleteDuplicate()

			await this.updateCurrentBlockNumber()

			this.task()
		} else {
			// Sleep 5 minutes
			await new Promise(resolve => setTimeout(resolve, 300000))

			this.task()
		}
	}

	public start(): void {
		this.task()
	}
}
