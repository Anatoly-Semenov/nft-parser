import Transaction from "./transaction"
import TransactionMissing from "./transaction-missing"
import TransactionDuplicatesClean from "./transaction-duplicates-clean"

// Example providers:
// Solana: "https://crimson-fragrant-bush.matic.quiknode.pro/d7ecbf281b295d11f8c6e59abd47d02069d5e7b8/"
// BSC: "https://misty-quiet-smoke.bsc.quiknode.pro/a6898e74758e97a47d35eabb2a57e20d725db736/"

export const collectTransactions = new Transaction(process.env.PROVIDER_URL!)

export const cleanTransactionsDuplicates = new TransactionDuplicatesClean()

export const collectMissingTransactions = new TransactionMissing(
	process.env.PROVIDER_URL!
)
