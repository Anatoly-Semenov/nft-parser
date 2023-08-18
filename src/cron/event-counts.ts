// Interfaces
import { IEventCount, ContractEventResponse } from "../types/"

interface LocalEvent {
	address: string
	from: string
	to: string
	value: number
}

// Types
import { EventCountType } from "../types/"

// Console
import consola from "consola"

// Progress-cli
import { progressCLI } from "../plugins/global"
const progress = progressCLI("Fetching events")

// Data
let maxBlockNumber: number = 0
let events: LocalEvent[] = []
const eventsCounts: IEventCount[] = []

// Web3
import Web3 from "web3"
const provider = new Web3.providers.HttpProvider(
	"https://speedy-nodes-nyc.moralis.io/6e0f50a66a78f77341141458/bsc/mainnet"
)
// @ts-ignore
const web3 = new Web3(provider, null, {})
// @ts-ignore todo: need refactoring
const contract = new web3.eth.Contract("ABI", "GAME_CONTRACT_ADDRESS")

// Methods
const prepareLogs = (blocks: number): void => {
	consola.info("Start fetching events")

	progress.start(blocks, 0)
}

const fetchMaxBlockNumber = async (): Promise<void> => {
	await web3.eth
		.getBlockNumber()
		.then((value: number) => {
			maxBlockNumber = value
		})
		.catch(error => {
			consola.error(new Error("Failed to fetch max block number"))
			consola.info(error)
		})
}

const fetchLastEvents = async (blocks: number) => {
	const iterations: number = blocks / 1000
	const firstBlock: number = maxBlockNumber - blocks

	for (let index = 1; index <= iterations; index++) {
		const from = firstBlock + index * 1000

		try {
			let newEvents: any = await contract.getPastEvents("Transfer", {
				fromBlock: from,
				toBlock: from + 1000
			})

			newEvents = newEvents.map((event: ContractEventResponse) => {
				return {
					address: event.address,
					from: event.returnValues.from,
					to: event.returnValues.to,
					value: event.returnValues.value
				}
			})

			events = [...events, ...newEvents]

			progress.update(index * 1000)
		} catch (error) {
			consola.error(
				new Error(
					`Failed to fetch past events from block: ${from}, to block: ${from +
						1000}`
				)
			)
			consola.info(error)
		}
	}

	progress.stop()

	consola.success("All events successfully fetched")
}

const setEventsCounts = () => {
	const addresses: string[] = []

	// Collect uniq addresses
	events.forEach(({ from, to }) => {
		if (!addresses.includes(from)) {
			addresses.push(from)
		}

		if (!addresses.includes(to)) {
			addresses.push(to)
		}
	})

	// Set events counts
	addresses.forEach((address: string) => {
		const addressEvents = events.filter(
			({ from, to }) => address === from || address === to
		)

		// Out events data
		const outEvents = addressEvents.filter(({ from }) => from === address)
		const amountOut = outEvents
			.map(({ value }) => value / 10 ** 18)
			.reduce((a, b) => a + b, 0)

		// In events data
		const inEvents = addressEvents.filter(({ to }) => to === address)
		const amountIn = inEvents
			.map(({ value }) => value / 10 ** 18)
			.reduce((a, b) => a + b, 0)

		eventsCounts.push({
			address: address,
			amountOut: amountOut,
			amountIn: amountIn,
			outCount: outEvents.length,
			inCount: inEvents.length,
			txCount: addressEvents.length
		})
	})
}

const getTopCounts = (countName: EventCountType) => {
	let sortingEvents: IEventCount[] = []
	const eventCounters: string[] = [
		"amountOut",
		"amountIn",
		"txCount",
		"inCount",
		"outCount"
	]

	const counterIndex: number = eventCounters.indexOf(countName)

	eventCounters.splice(counterIndex, 1)
	eventCounters.push(countName)

	for (const counter of eventCounters) {
		sortingEvents = eventsCounts.sort((a: IEventCount, b: IEventCount) => {
			// @ts-ignore
			return b[counter] - a[counter]
		})
	}

	if (sortingEvents.length > 20) sortingEvents.splice(20)

	consola.log(sortingEvents)
}

export const collectCounts = async (
	blocks: number = 100000,
	countName: EventCountType = "inCount"
): Promise<void> => {
	consola.info("Start collect event-counts")

	await fetchMaxBlockNumber()

	prepareLogs(blocks)

	await fetchLastEvents(blocks)

	setEventsCounts()

	getTopCounts(countName)

	consola.success("FINISH")
}
