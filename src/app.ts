import fs from 'fs'
import { API } from './api'

const Api: API = new API('./env/tokens.json', true)

const codamCampusID = 14
const jkoersID = 66365
const joppeID = 105119
const netPracticeID = 2007


async function getEvents() {
	return await Api.get(`/v2/campus/${codamCampusID}/events`)
}

async function getProjects() {
	return await Api.getPaged('/v2/projects/')
}

async function getProjectSubscribers(projectID: number): Promise<any[]> {
	return await Api.getPaged(`/v2/projects/${projectID}/projects_users`, [{ 'filter[campus]': codamCampusID }])
}

(async () => {
	const projectIDs = JSON.parse(fs.readFileSync('./data/projectIDs.json').toString())

	for (const id in projectIDs) {
		console.log(id)
		const subs = await getProjectSubscribers(projectIDs[id])
		for (const sub of subs) {
			if (sub.status != 'finished')
				console.log(`${sub.user.login},${sub.status},${sub.marked}`)
		}
		console.log('\n')
	}
	// console.log(subs)
})()
