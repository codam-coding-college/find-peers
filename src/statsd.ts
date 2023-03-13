import { StatsD as StatsDObj } from 'hot-shots'
import { env } from './env'

const client = new StatsDObj({
	port: 8125,
	host: 'localhost',
	errorHandler: console.error,
})

const stats = {
	visits: Object.keys(env.campusIDs) as unknown as keyof typeof env.campusIDs,
} as const

export namespace StatsD {
	export type Stat = keyof typeof stats
	export type Tag<T extends Stat> = typeof stats[T]

	export function increment(stat: Stat, tag?: Tag<Stat>): void {
		if (tag) {
			client.increment(stat, [tag])
		} else {
			client.increment(stat)
		}
	}
}
