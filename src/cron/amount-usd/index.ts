import { AmountUsd } from "./amount-usd"

export const cyballAmountUSD = new AmountUsd({
	_TOKEN_SYMBOL: "CYBALL",
	_TABLE_PREFIX: "cyball",
	_GAME_CONTRACT_ADDRESS: "0x7c73967dC8c804Ea028247f5A953052f0CD5Fd58"
})

export const bcoinAmountUSD = new AmountUsd({
	_TOKEN_SYMBOL: "BCOIN",
	_TABLE_PREFIX: "bcoin",
	_GAME_CONTRACT_ADDRESS: "0x00e1656e45f18ec6747F5a8496Fd39B50b38396D"
})
