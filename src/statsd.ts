import { StatsD as StatsDObj } from 'hot-shots'
import { env } from './env'

const client = new StatsDObj({
	port: 8125,
	host: 'datadog-agent', // TODO use env
	errorHandler: console.error,
})

const stats = {
	visits: Object.keys(env.campusIDs) as unknown as keyof typeof env.campusIDs,
} as const

for (const stat of Object.keys(stats)) {
	if (stat != stat.toLowerCase())
		throw new Error(`StatsD stat "${stat}" must be lowercase`)
}

export namespace StatsD {
	export type Stat = keyof typeof stats
	export type Tag<T extends Stat> = typeof stats[T]

	export function increment(stat: Stat, tag?: Tag<Stat>): void {
		if (!tag) {
			return client.increment(stat)
		}

		// Datadog only allows some characters in tags
		const tagNormalized = tag
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/ |-/g, '_')
			.toLowerCase()
		client.increment(stat, [tagNormalized])
	}
}
