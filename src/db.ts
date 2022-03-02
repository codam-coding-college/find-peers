import fs from 'fs'
import { API } from './api'
import { User, Project, ProjectSubscriber } from './types'
import { env } from './env'

const Api: API = new API(env.clientUID, env.clientSecret, false)
export let projects: Project[] = JSON.parse(fs.readFileSync('./database/projectUsers.json').toString())

let lastPull: number = 0
if (!fs.existsSync('./database/lastpull.txt'))
	fs.writeFileSync('./database/lastpull.txt', '0')
else
	lastPull = parseInt(fs.readFileSync('./database/lastpull.txt').toString())

export async function getEvents() {
	return await Api.get(`/v2/campus/${env.codamCampusID}/events`)
}

export async function getProjects() {
	return await Api.getPaged('/v2/projects/')
}

export async function getProjectSubscribers(projectID: number): Promise<ProjectSubscriber[]> {
	const users: User[] = await Api.getPaged(
		`/v2/projects/${projectID}/projects_users`,
		[{ 'filter[campus]': env.codamCampusID }],
		// (data) => console.log(data)
	)
	const projectSubscribers = users.map(x => ({
		login: x.user.login,
		status: x.status,
		image_url: x.user.image_url.replace('https://cdn.intra.42.fr/users/', 'https://cdn.intra.42.fr/users/small_')
	}))
	return projectSubscribers
}

export async function saveAllProjectSubscribers(path: string) {
	const lastPullAgo = Date.now() - lastPull
	if (lastPullAgo < env.pullTimeout) {
		console.log('Not pulling because last pull was', lastPullAgo / 1000 / 60, 'minutes ago')
		console.log('Timeout is', env.pullTimeout / 1000 / 60, 'minutes')
		return
	}

	console.time('Pull took:')
	const newProjects: Project[] = []
	for (const id in env.projectIDs) {
		console.log(`Pulling the subscribers of`, id)
		const item: Project = {
			name: id,
			users: await getProjectSubscribers(env.projectIDs[id!])
		}
		console.log(`\t total users: ${item.users.length}`)
		newProjects.push(item)
	}
	projects = newProjects
	console.time('Pull took:')
	await fs.promises.writeFile(path, JSON.stringify(newProjects))

}
