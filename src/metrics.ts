import fs from 'fs'

interface Visitor {
	id: string
	date: Date
}

interface Metrics {
	visitorsLast: {
		hour: number
		day: number
		month: number
	}
	nVisitors: number
	visitors: Visitor[]
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

	public async addVisitor(id: string): Promise<void> {
		// TODO: could be better
		// when the user reloads the page, do not count it as a new visitor
		if (this.visitors[this.visitors.length - 1]?.id !== id)
			this.visitors.push({ id: id, date: new Date() })
		if (this.visitors.length > 5_000_000) this.visitors.slice(1)
		await fs.promises.writeFile(this.dbPath, JSON.stringify(this.visitors))
	}

	uniqueVisitorsInLast(timeMs: number) {
		const now = Date.now()
		let visitors = this.visitors.filter((x) => now - x.date.getTime() < timeMs)
		visitors = visitors.filter((current, pos) => visitors.findIndex(x => x.id === current.id) === pos)
		return visitors
	}

	public generateMetrics(): Metrics {
		const hour = this.uniqueVisitorsInLast(3600 * 1000).length
		const day = this.uniqueVisitorsInLast(24 * 3600 * 1000).length
		const month = this.uniqueVisitorsInLast(30 * 24 * 3600 * 1000).length

		return {
			visitorsLast: {
				hour,
				day,
				month,
			},
			nVisitors: this.visitors.length,
			visitors: this.visitors,
		}
	}
	private readonly dbPath: string = '/tmp/visitors.json'
	private visitors: Visitor[] = []
}
