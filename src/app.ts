import { saveAllProjectSubscribers, saveAllProjectSubscribersForCampus } from './db'
import { startWebserver } from './express'
import { env, Campus } from './env'

(async () => {
	if (process.argv[2] == '--help' || process.argv[2] == '-h') {
		console.log('Options')
		console.log('\t --help -h                                  show this help')
		console.log('\t --only-update-project-users                write the project status of all students of all campuses to the database')
		console.log('\t --only-update-project-users [campusId]     write the project status of all students for a specific campusId (number) to the database')
		console.log('\t --only-update-project-users [campusName]   write the project status of all students for a specific campusName (e.g. Amsterdam, Paris) to the database')
		process.exit(0)
	}

	if (process.argv[2] == '--only-update-project-users' && !process.argv[3]) {
		await saveAllProjectSubscribers()
		process.exit(0)
	}
	else if (process.argv[2] == '--only-update-project-users' && process.argv[3]) {
		const campus: Campus | undefined = env.campuses.find(campus => campus.id == parseInt(process.argv[3]!) || campus.name.toLowerCase() == process.argv[3]?.toLowerCase())
		if (!campus) {
			console.log(`Campus "${process.argv[3]}" not found`)
			process.exit(1)
		}

		await saveAllProjectSubscribersForCampus(campus)
		process.exit(0)
	}

	const port = parseInt(process.env['PORT'] || '8080')
	await startWebserver(port)

	while (true) {
		await saveAllProjectSubscribers()
		await new Promise((resolve, reject) => setTimeout(resolve, env.pullTimeout))
	}
})()
