export type CollectType = "events" | "transactions"

export interface ContractEvent {
	user?: string
	txHash: string
	chain: string
	type?: string
	token: {
		address: string
		symbol: string
		decimals: number
	}
	amount: number
	amountUSD: number | null
	blockNumber: number
	date: string | null
}

export interface ContractEventMVP {
	txHash: string
	chain: string
	token_address: string
	token_symbol: string
	token_decimals: number
	amount: number
	amountUSD: number | null
	blockNumber: number
	date: string | null
	from: string
	to: string
}

export interface ContractEventResponse {
	returnValues: {
		[key: string]: any
		//  "0": string
		//  "1": string
		//  "2": string
		//  from: string
		//  to: string
		//  value: string
	}
	raw: {
		data: string
		topics: string[]
	}
	event: string
	signature: string
	logIndex: number
	transactionIndex: number
	transactionHash: string
	blockHash: string
	blockNumber: number
	address: string
}

export interface ICounter {
	type: string
	value: number
}

export interface IBlockDate {
	coin: string
	date: string
	blockNumber: number
}

export interface IAmountUSD {
	coin: string
	date: string
	value: number | "No date"
}

export interface IEventCount {
	address: string
	amountOut: number
	amountIn: number
	outCount: number
	inCount: number
	txCount: number
}

export type EventCountType =
	| "amountOut"
	| "amountIn"
	| "outCount"
	| "inCount"
	| "txCount"

export interface GameConfig {
	_PROVIDER_URL: string
	_TOKEN_SYMBOL?: string
	_TABLE_PREFIX: string
	_MIN_BLOCK: string
	_COUNTER_NAME: string
	_CONTRACT_ADDRESS: string
	_TOPIC_ADDRESS: string
	_ABI: object
	_EVENT_REASON: string
	_EVENT_TYPE: string
	_EVENT_NAME: string
}

export interface ITransaction {
	blockHash?: string
	hash?: string

	blockNumber?: number

	to?: string
	from?: string
	nonce: number

	gasLimit: number
	gasPrice?: number

	data: string
	value: number
	chainId: number

	r?: string
	s?: string
	v?: number

	input?: string

	// Typed-Transaction features
	type?: number | null

	// EIP-2930 Type 1 & EIP-1559 Type 2
	accessList?: Array<{ address: string; storageKeys: Array<string> }>

	// EIP-1559 Type 2
	maxPriorityFeePerGas?: number
	maxFeePerGas?: number
}

export interface ITransactionBlock {
	difficulty: string
	gasLimit: string
	gasUsed: string
	hash: string
	miner: string
	mixHash: string
	nonce: string
	number: number
	parentHash: string
	receiptsRoot: string
	sha3Uncles: string
	size: number
	stateRoot: string
	timestamp: number
	totalDifficulty: string
	transactions: ITransaction[]
}

export interface IConvertedTransaction {
	tx_hash: string
	block_number: number | string
	timestamp: string | null
	address_from: string | null
	address_to: string | null
	value: string | number | null
	input: string | null
}
