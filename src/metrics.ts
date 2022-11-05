import fs from 'fs'
import { env } from './env'

interface Visitor {
	id: string
	campus: string
	date: Date
}

interface Metric {
	hour: number
	day: number
	month: number
}

interface Metrics {
	uniqVisitorsTotal: Metric
	uniqVisitorsCampus: ({ name: string } & Metric)[]
	nVisitors: number
	visitors: Visitor[]
}

// get unique elements in array based on equalFn()
function unique<T>(arr: T[], equalFn: (a: T, b: T) => boolean): T[] {
	return arr.filter((current, pos) => arr.findIndex(x => equalFn(x, current)) === pos)
}

export class MetricsStorage {
	constructor() {
		if (!fs.existsSync(this.dbPath)) {
			fs.writeFileSync(this.dbPath, '[]')
		}
		try {
			this.visitors = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'))
		} catch (err) { }
	}

	public async addVisitor(id: string, campus: string): Promise<void> {
		// when the user reloads the page, do not count it as a new visitor
		if (this.visitors[this.visitors.length - 1]?.id !== id)
			this.visitors.push({ id, campus, date: new Date() })
		if (this.visitors.length > 5_000_000) this.visitors.slice(1)
		await fs.promises.writeFile(this.dbPath, JSON.stringify(this.visitors))
	}

	uniqueVisitorsInLast(timeMs: number): Visitor[] {
		const now = Date.now()
		let visitors = this.visitors.filter((x) => now - x.date.getTime() < timeMs)
		visitors = unique(visitors, (a, b) => a.id === b.id)
		visitors = visitors.map((x) => ({ ...x, id: x.id.substring(5, -5) })) // cut a little of the id to keep it private
		return visitors
	}

	public generateMetrics(): Metrics {
		const hour = this.uniqueVisitorsInLast(3600 * 1000)
		const day = this.uniqueVisitorsInLast(24 * 3600 * 1000)
		const month = this.uniqueVisitorsInLast(30 * 24 * 3600 * 1000)

		return {
			uniqVisitorsTotal: {
				hour: hour.length,
				day: day.length,
				month: month.length,
			},
			uniqVisitorsCampus: env.campuses.map((campus) => ({
				name: campus.name,
				hour: hour.filter((x) => x.campus === campus.name).length,
				day: day.filter((x) => x.campus === campus.name).length,
				month: month.filter((x) => x.campus === campus.name).length,
			})),
			nVisitors: this.visitors.length,
			visitors: this.visitors,
		}
	}

	private readonly dbPath: string = env.databaseRoot + '/visitors.json'
	private visitors: Visitor[] = []
}
