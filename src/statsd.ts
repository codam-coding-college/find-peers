import { StatsD as StatsDObj } from 'hot-shots'

const client = new StatsDObj({
	port: 8125,
	host: 'datadog-agent', // TODO use env
	errorHandler: console.error,
})

export namespace StatsD {
	export function increment(stat: string, tag?: string): void {
		if (!isValidDataDogStr(stat)) {
			return console.error(`Invalid stat ${stat}`)
		}
		if (tag && !isValidDataDogStr(tag)) {
			return console.error(`Invalid tag ${tag} for stat ${stat}`)
		}
		client.increment(stat, tag ? [tag] : [])
	}

	export function strToTag(prefix: string, str: string): string {
		const normalized = str
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]/g, '_')
		return `${prefix}:${normalized}`
	}
}

function isValidDataDogStr(tag: string): boolean {
	return /^[a-z0-9_:]+$/.test(tag)
}
