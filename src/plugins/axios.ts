// Axios default settings
import axios from "axios"
import Qs from "qs"

export default function() {
	axios.defaults.baseURL = process.env.BASE_API_URL
	// Format nested params correctly
	axios.interceptors.request.use((config): object => {
		config.paramsSerializer = params => {
			// Qs is not included in the Axios package
			return Qs.stringify(params, {
				arrayFormat: "brackets",
				encode: false
			})
		}

		return config
	})
}
