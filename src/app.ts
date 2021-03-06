import { syncCampuses, campusDBs } from './db'
import { startWebserver } from './express'
import { env } from './env'

function msUntilNextPull(): number {
	let nextPull = env.pullTimeout
	for (const campus of env.campuses) {
		const lastPullAgo = Date.now() - campusDBs[campus.name].lastPull
		const msUntilNexPull = Math.max(0, env.pullTimeout - lastPullAgo)
		nextPull = Math.min(nextPull, msUntilNexPull)
	}
	return nextPull
}

(async () => {
	const port = parseInt(process.env['PORT'] || '8080')
	await startWebserver(port)

	while (true) {
		await syncCampuses()
		await new Promise(resolve => setTimeout(resolve, msUntilNextPull() + 1000))
	}
})()
