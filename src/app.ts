import { saveAllProjectSubscribers } from './db'
import { startWebserver } from './express'

(async () => {
	if (process.argv[2] == '--help' || process.argv[2] == '-h') {
		console.log('Options')
		console.log('\t--help -h                      show this help')
		console.log('\t --only-update-project-users   write the project status of all students to the json ./data/projectUsers.json')
		process.exit(0)
	}

	if (process.argv[2] == '--only-update-project-users') {
		await saveAllProjectSubscribers('./data/projectUsers.json')
		process.exit(0)
	}

	const port = parseInt(process.env['PORT'] || '8080')
	startWebserver(port)

	// while (true) {
	// 	await saveAllProjectSubscribers('./data/projectUsers.json')
	// 	await new Promise((resolve, reject) => setTimeout(resolve, 2 * 60 * 1000))
	// }
})()
