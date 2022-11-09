import fs from 'fs'
import { env } from './env'
import crypto from 'crypto'
import { UserProfile } from './types'

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
			this.visitors = (JSON.parse(fs.readFileSync(this.dbPath, 'utf8')) as Visitor[])
				.map((x) => ({ ...x, date: new Date(x.date) })) // in JSON Date is stored as a string, so now we convert it back to Date
		} catch (err) { }
	}

	public async addVisitor(user: UserProfile): Promise<void> {
		// create a hash instead of storing the user id directly, for privacy
		const rawID = user.id.toString() + user.login + env.tokens.metricsSalt
		const id = crypto.createHash('sha256').update(rawID).digest('hex')

		// when the user reloads the page, do not count it as a new visitor
		if (this.visitors[this.visitors.length - 1]?.id !== id)
			this.visitors.push({ id, campus: user.campusName, date: new Date() })
		if (this.visitors.length > 5_000_000)
			this.visitors.slice(1)
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

		const uniqVisitorsCampus = env.campuses
			.map((campus) => ({
				name: campus.name,
				hour: hour.filter((x) => x.campus === campus.name).length,
				day: day.filter((x) => x.campus === campus.name).length,
				month: month.filter((x) => x.campus === campus.name).length,
			}))
			.sort((a, b) => b.day - a.day)

		return {
			uniqVisitorsTotal: {
				hour: hour.length,
				day: day.length,
				month: month.length,
			},
			uniqVisitorsCampus,
			nVisitors: this.visitors.length,
			visitors: this.visitors,
		}
	}

	private readonly dbPath: string = env.databaseRoot + '/visitors.json'
	private visitors: Visitor[] = []
}
