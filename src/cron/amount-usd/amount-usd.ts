import cron from "node-cron"
import dayjs from "dayjs"
import axios from "axios"

// DB
import db from "../../db"

// Console
import consola from "consola"

// Interfaces
interface IDate {
	coingecoDate: string
	timestamp: string
}

type AmountUsdType = number | null

export class AmountUsd {
	private TOKEN_SYMBOL: string
	private TABLE_PREFIX: string
	private GAME_CONTRACT_ADDRESS: string
	private binanceId: string = ""
	private lastDate: string | null = null

	// Date formats
	private coingecoFormat: string = "DD-MM-YYYY"
	private timestampFormat: string = "YYYY-MM-DD"

	// API
	private coingeckoAPi: string = "https://api.coingecko.com/api/v3"

	constructor({ _TOKEN_SYMBOL, _TABLE_PREFIX, _GAME_CONTRACT_ADDRESS }: any) {
		this.TOKEN_SYMBOL = _TOKEN_SYMBOL
		this.TABLE_PREFIX = _TABLE_PREFIX
		this.GAME_CONTRACT_ADDRESS = _GAME_CONTRACT_ADDRESS
	}

	private fetchBinanceId = async (): Promise<void> => {
		await axios(
			`${this.coingeckoAPi}/coins/binance-smart-chain/contract/${this.GAME_CONTRACT_ADDRESS}`
		)
			.then(({ data }) => {
				this.binanceId = data.id
			})
			.catch(error => {
				consola.error(
					new Error(
						`Failed to fetch ${this.TABLE_PREFIX} binance-smart-chain id`
					)
				)
				consola.info(error)
			})
	}

	private fetchAmountUSD = async (date: string): Promise<AmountUsdType> => {
		let amountUSD: AmountUsdType = 0

		await axios(`${this.coingeckoAPi}/coins/${this.binanceId}/history`, {
			params: {
				date: date
			}
		})
			.then(({ data }) => {
				amountUSD = data?.market_data?.current_price?.usd || null
			})
			.catch(error => {
				consola.error(
					new Error(`Failed to fetch coin history from date:${date}`)
				)
				consola.info(error)
			})

		return amountUSD
	}

	private getLastYearDates(): IDate[] {
		const days: IDate[] = []

		for (let month: number = 1; month <= 12; month++) {
			const date = dayjs()
				.subtract(12 - month, "months")
				.format("YYYY-MM")

			const daysInMonth = dayjs(date, "YYYY-MM").daysInMonth()

			for (let day: number = 0; day <= daysInMonth; day++) {
				const coingecoDate = dayjs(date)
					.add(day, "day")
					.format(this.coingecoFormat)

				const timestamp = dayjs(date)
					.add(day, "day")
					.format(this.timestampFormat)

				days.push({
					coingecoDate: coingecoDate,
					timestamp: timestamp
				})
			}
		}

		return days
	}

	public async collectPerYear(): Promise<void> {
		const dates: IDate[] = this.getLastYearDates()

		await this.collectDates(dates)
	}

	private async collectMissingDates(): Promise<void> {
		const nowDate = dayjs(new Date()).format(this.timestampFormat)
		const diff: number = dayjs(nowDate).diff(this.lastDate, "days")

		if (diff) {
			const newDates: IDate[] = []

			for (let index: number = 1; index <= diff; index++) {
				const newDate = dayjs(this.lastDate).add(index, "days")

				const timestamp: string = newDate.format(this.timestampFormat)
				const coingecoDate: string = newDate.format(this.coingecoFormat)

				newDates.push({ coingecoDate: coingecoDate, timestamp: timestamp })
			}

			await this.collectDates(newDates)
		}
	}

	private async collectTodayPrice(): Promise<void> {
		const today = dayjs(new Date())

		const days: IDate[] = [
			{
				coingecoDate: today.format(this.coingecoFormat),
				timestamp: today.format(this.timestampFormat)
			}
		]

		await this.collectDates(days)
	}

	private async collectDates(dates: IDate[]): Promise<void> {
		if (!this.binanceId) await this.fetchBinanceId()

		for (const date of dates) {
			const { coingecoDate, timestamp } = date

			const value: AmountUsdType = await this.fetchAmountUSD(coingecoDate)
			const isToday: boolean =
				coingecoDate === dayjs(new Date()).format(this.coingecoFormat)

			if (isToday) {
				const tomorrow: string = dayjs(new Date())
					.add(1, "day")
					.format(this.timestampFormat)

				await this.setDateToDB(timestamp, value)
				await this.setDateToDB(tomorrow, value)
			} else {
				await this.setDateToDB(timestamp, value)
			}

			// Sleep 1 second
			await new Promise(resolve => setTimeout(resolve, 1000))
		}
	}

	private async setDateToDB(timestamp: string, value: AmountUsdType) {
		await db
			.any(
				`
				DO $$
				BEGIN
					IF NOT EXISTS (SELECT * from ${this.TABLE_PREFIX}_amount_usd WHERE date = $2) THEN
							INSERT INTO ${this.TABLE_PREFIX}_amount_usd (coin, date, value) VALUES ($1, $2, $3);
					ELSE
							UPDATE ${this.TABLE_PREFIX}_amount_usd SET value = $3 WHERE date = $2;
					END IF;
				END;
				$$;
				`,
				[this.TOKEN_SYMBOL, timestamp, value]
			)
			.catch((error: object) => {
				consola.error(new Error("Failed set amount usd to DB"))
				consola.info(error)
			})
	}

	private async getLastDate() {
		await db
			.query(
				`SELECT "date" FROM ${this.TABLE_PREFIX}_amount_usd ORDER BY "date" DESC LIMIT 1 OFFSET 0`
			)
			.then((rows: any) => {
				const lastDate = rows?.[0].date

				if (lastDate) {
					this.lastDate = lastDate
				}
			})
			.catch((error: object) => {
				consola.error(
					new Error(
						`Failed to get last date from table ${this.TABLE_PREFIX}_amount_usd`
					)
				)
				consola.info(error)
			})
	}

	public cron() {
		// Every hour collect today token price
		cron.schedule("0 * * * *", async () => {
			this.collectTodayPrice()
		})
	}

	public async startCollect() {
		await this.getLastDate()

		if (this.lastDate) {
			this.collectMissingDates()
		} else {
			await this.collectPerYear()
		}
	}
}
