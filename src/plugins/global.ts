// Progress-cli
import cliProgress from "cli-progress"
import colors from "ansi-colors"

// Methods

export const convertNumber = (value: number | null) => {
	if (value) {
		return parseInt(`${(Number(value) / 10 ** 18) * 100}`) / 100
	}

	return null
}

export const progressCLI = (
	progressName: string = "Progress",
	itemsName: string = "Блоков",
	barCompleteChar: string = "\u2588",
	barIncompleteChar: string = "\u2591"
): any => {
	return new cliProgress.SingleBar({
		format:
			`${progressName} |` +
			colors.cyan("{bar}") +
			`| {percentage}% || {value}/{total} ${itemsName}`,
		barCompleteChar: barCompleteChar,
		barIncompleteChar: barIncompleteChar,
		hideCursor: true
	})
}
