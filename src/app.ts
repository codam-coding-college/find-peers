// eslint-disable-next-line
require('dotenv').config({ path: __dirname + '/../env/.env' })

import { startWebserver } from './express'
import { env } from './env'
import { DatabaseService } from './services';
import { syncWithIntra } from './sync'
import { log } from './logger'
import util from 'util'

// set depth of object expansion in terminal as printed by console.*()
util.inspect.defaultOptions.depth = 10;

/**
 * Calculates the time in milliseconds until the next pull request should be made.
 * @returns How many milliseconds until the next pull request should be made.
 */
async function msUntilNextPull(): Promise<number> {
	const lastPullAgo = await DatabaseService.getLastSyncTimestamp("full", 1).then(date => {
		if (!date) {
			log.warn('No last sync timestamp found, assuming first pull.');
			return env.pullTimeout;
		}
		return Date.now() - date.getTime();
	});
	const msUntilNextPull = Math.max(0, env.pullTimeout - lastPullAgo);
	if (msUntilNextPull === 0) {
		log.warn(`Last pull was more than ${env.pullTimeout / 1000 / 60 / 60} hours ago, pulling immediately.`);
		return (0);
	}
	log.info(`Next pull will be in ${(msUntilNextPull / 1000 / 60 / 60).toFixed(2)} hours.`);
	return msUntilNextPull;
}

// Main Program Execution
;(async () => {
	const port = parseInt(process.env['PORT'] || '8080');
	await startWebserver(port);

	while (true) {
		// Guard the whole loop body: a throw from any stage (a DB socket timeout in
		// anonymizeOldEntries, an error computing the next pull time, etc.) must not
		// become an unhandled rejection that kills the daemon. Log it and keep looping.
		let delay = env.pullTimeout;
		try {
			await syncWithIntra();
			await DatabaseService.anonymizeOldEntries();
			delay = await msUntilNextPull();
		} catch (error) {
			log.error(`Sync loop iteration failed; retrying in ${(delay / 1000 / 60 / 60).toFixed(2)} hours`, error);
		}
		await new Promise(resolve => setTimeout(resolve, delay + 1000));
	}
})()
