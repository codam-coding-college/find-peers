import fs from 'fs'
import { API } from './api'
import { User, ProjectSubscribers, ProjectSubscriber } from './types'

const Api: API = new API('./env/tokens.json', true)

const _42CursusID = 21
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

async function getProjectSubscribers(projectID: number): Promise<ProjectSubscriber[]> {
	const users: User[] = await Api.getPaged(
		`/v2/projects/${projectID}/projects_users`,
		[{ 'filter[campus]': codamCampusID }],
		// (data) => console.log(data)
	)
	const projectSubscribers = users.map(x => ({
		login: x.user.login,
		status: x.status,
		image_url: x.user.image_url.replace('https://cdn.intra.42.fr/users/', 'https://cdn.intra.42.fr/users/small_')
	}))
	return projectSubscribers
}

async function writeProjectsToJSON(path: string, ids: { [key: string]: number }[]) {
	const projects: ProjectSubscribers[] = []
	for (const id in ids) {
		const item: ProjectSubscribers = {
			name: id,
			users: await getProjectSubscribers(ids[id!])
		}
		projects.push(item)
	}
	await fs.promises.writeFile(path, JSON.stringify(projects))
}

(async () => {
	const projectIDs: { [key: string]: number }[] = JSON.parse(fs.readFileSync('./data/projectIDs.json').toString())
	writeProjectsToJSON('./data/projectUsers.json', projectIDs)
})()
