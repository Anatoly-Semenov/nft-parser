import consola from "consola"

export const banner = () => {
	let environment = ""
	switch (process.env.NODE_ENV) {
		case "production":
			environment = "production           |"
			break
		default:
			environment = "development          |"
			break
	}

	let collectType = ""
	switch (process.env.COLLECT_TYPE) {
		case "transactions":
			collectType = "Transactions        |"
			break
	}

	console.log(
		`
   ╭───────────────────────────────────────╮
   │                                       │
   │   Node.js @ v12.22.7                  │
   │                                       │
   │   ▸ Service: collect-service          │
   │   ▸ Type: Cron                        │
   │   ▸ Collect type: ${collectType}
   │   ▸ Environment: ${environment}
   │                                       │
   ╰───────────────────────────────────────╯

			`
	)
	consola.success(`App ready to use`)
}
