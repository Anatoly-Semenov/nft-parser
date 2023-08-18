require("dotenv").config()
import { banner } from "./build"
import { CollectType } from "./types"

// Plugins
import axios from "./plugins/axios"
axios()

// Cron
import {
	collectTransactions,
	cleanTransactionsDuplicates,
	collectMissingTransactions
} from "./cron/transactions/"

function start(): void {
	banner()

	switch (process.env.COLLECT_TYPE as CollectType) {
		case "transactions":
			// Collect transactions script
			collectTransactions.startCollectTransactions()

			// Collect missing transactions script
			collectMissingTransactions.start()

			// Clean duplicates transactions script
			cleanTransactionsDuplicates.start()
			break
	}
}

start()
