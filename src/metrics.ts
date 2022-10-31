interface Visitor {
	id: string;
	date: Date;
}

interface Metrics {
	visitorsLast: {
		hour: number;
		day: number;
		month: number;
	};
	visitors: Visitor[];
}

export class MetricsStorage {
	public addVisitor(id: string): void {
		// TODO: could be better
		if (this.visitors[this.visitors.length - 1]?.id !== id)
			// when the user reloads the page, do not count it as a new visitor
			this.visitors.push({ id: id, date: new Date() });
		if (this.visitors.length > 5_000_000) this.visitors.slice(1);
	}

	public generateMetrics(): Metrics {
		const now = Date.now();
		const hour = this.visitors.filter((x) => now - x.date.getTime() < 3600 * 1000).length
		const day = this.visitors.filter((x) => now - x.date.getTime() < 24 * 3600 * 1000).length
		const month = this.visitors.filter((x) => now - x.date.getTime() < 30 * 24 * 3600 * 1000).length
		return {
			visitorsLast: {
				hour,
				day,
				month,
			},
			visitors: this.visitors,
		};
	}

	private visitors: Visitor[] = [];
}
