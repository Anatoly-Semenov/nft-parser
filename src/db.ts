const pgp = require("pg-promise")({})
import fs from "fs"
import path from "path"

// Data
const {
	POSTGRES_USER,
	POSTGRES_HOST,
	POSTGRES_DATABASE,
	POSTGRES_PASSWORD,
	POSTGRES_PORT
} = process.env

const db = pgp({
	user: POSTGRES_USER,
	host: POSTGRES_HOST,
	database: POSTGRES_DATABASE,
	password: POSTGRES_PASSWORD,
	port: Number(POSTGRES_PORT),
	ssl: false
	// ssl: {
	// 	// Ensure we *are* rejecting unauthorized identities
	// 	rejectUnauthorized: true,
	//
	// 	// Path to the downloaded digital ocean cert
	// 	ca: fs
	// 		.readFileSync(path.resolve(__dirname, "./ca-certificate.crt"))
	// 		.toString()
	// }
})

export default db
