import { StatsD as StatsDObj } from 'hot-shots'
import { env } from './env'

const client = new StatsDObj({
	port: 8125,
	host: 'localhost',
	errorHandler: console.error,
})

const stats = [{
	stat: 'visits',
	tags: Object.keys(env.campusIDs) as unknown as keyof typeof env.campusIDs,
}] as const

export namespace StatsD {
	export type Stat = typeof stats[number]['stat']
	export type Tag = typeof stats[number]['tags'][number]

	export function increment(stat: Stat, tag?: Tag): void {
		if (tag) {
			client.increment(stat, [tag])
		} else {
			client.increment(stat)
		}
	}
}
