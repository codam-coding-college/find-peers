// eslint-disable-next-line
require('dotenv').config({ path: __dirname + '/../env/.env' })

import { startWebserver } from './express'
import { env } from './env'
import { DatabaseService } from './services';
import { anonymizeDatabase } from './anonymize'
import { syncWithIntra } from './sync'
import util from 'util'

// set depth of object expansion in terminal as printed by console.*()
util.inspect.defaultOptions.depth = 10;

/**
 * Calculates the time in milliseconds until the next pull request should be made.
 * @returns How many milliseconds until the next pull request should be made.
 */
async function msUntilNextPull(): Promise<number> {
	const lastPullAgo = await DatabaseService.getLastSyncTimestamp().then(date => {
		if (!date) {
			console.warn('No last sync timestamp found, assuming first pull.');
			return env.pullTimeout;
		}
		return Date.now() - date.getTime();
	});
	const msUntilNextPull = Math.max(0, env.pullTimeout - lastPullAgo);
	if (msUntilNextPull === 0) {
		console.warn(`Last pull was more than ${env.pullTimeout / 1000 / 60 / 60} hours ago, pulling immediately.`);
		return (0);
	}
	console.info(`Next pull will be in ${(msUntilNextPull / 1000 / 60 / 60).toFixed(2)} hours.`);
	return msUntilNextPull
}

// Main Program Execution
;(async () => {
	const port = parseInt(process.env['PORT'] || '8080');
	await startWebserver(port);

	while (true) {
		await syncWithIntra();
		await DatabaseService.anonymizeOldEntries();
		await new Promise(async resolve => setTimeout(resolve, await msUntilNextPull() + 1000));
	}
})()
