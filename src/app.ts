// eslint-disable-next-line
require('dotenv').config({ path: __dirname + '/../env/.env' })

import { syncCampuses, campusDBs } from './db'
import { startWebserver } from './express'
import { env } from './env'
import util from 'util'

// set depth of object expansion in terminal as printed by console.*()
util.inspect.defaultOptions.depth = 10

function msUntilNextPull(): number {
	let nextPull = env.pullTimeout
	for (const campus of Object.values(env.campuses)) {
		const lastPullAgo = Date.now() - campusDBs[campus.name].lastPull
		const msUntilNexPull = Math.max(0, env.pullTimeout - lastPullAgo)
		nextPull = Math.min(nextPull, msUntilNexPull)
	}
	return nextPull
}

;(async () => {
	const port = parseInt(process.env['PORT'] || '8080')
	await startWebserver(port)

	while (true) {
		await syncCampuses()
		await new Promise(resolve => setTimeout(resolve, msUntilNextPull() + 1000))
	}
})()
