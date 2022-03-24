import fs from 'fs'
import { API } from './api'
import { User, Project, ProjectSubscriber } from './types'
import { env, Campus } from './env'

const Api: API = new API(env.clientUID, env.clientSecret, false)

export interface CampusDB {
	projects: Project[]
	lastPull: number
}

export const campusDBs: { [key: string]: CampusDB }[] = []

fs.mkdirSync(env.databaseRoot, { recursive: true })
function setupCampusDB(campus: Campus) {
	const campusDB: CampusDB = {
		projects: [],
		lastPull: 0
	}

	fs.mkdirSync(campus.databasePath, { recursive: true })
	if (!fs.existsSync(campus.projectUsersPath))
		fs.writeFileSync(campus.projectUsersPath, '[]')
	campusDB.projects = JSON.parse(fs.readFileSync(campus.projectUsersPath).toString())
	if (!fs.existsSync(campus.lastPullPath))
		fs.writeFileSync(campus.lastPullPath, '0')
	campusDB.lastPull = parseInt(fs.readFileSync(campus.lastPullPath).toString())
	campusDBs[campus.name] = campusDB;
}

for (const i in env.campuses) {
	setupCampusDB(env.campuses[i]!)
}

export async function getEvents(campusID: number) {
	return await Api.get(`/v2/campus/${campusID}/events`)
}

export async function getProjects() {
	return await Api.getPaged('/v2/projects/')
}

export async function getProjectSubscribers(campusID: number, projectID: number): Promise<ProjectSubscriber[]> {
	const users: User[] = await Api.getPaged(
		`/v2/projects/${projectID}/projects_users`,
		[{ 'filter[campus]': campusID }],
		// (data) => console.log(data)
	)
	const projectSubscribers: ProjectSubscriber[] = []
	for (const x of users) {
		try {
			const valid = {
				login: x.user.login,
				status: x.status,
			}
			projectSubscribers.push(valid)
		} catch (e) { }
	}
	return projectSubscribers
}

export async function saveAllProjectSubscribersForCampus(campus: Campus) {
	if (!campusDBs[campus.name])
		throw new Error(`[${campus.name}] Campus Database missing or not set up`)
	const lastPullAgo = Date.now() - campusDBs[campus.name].lastPull
	if (lastPullAgo < env.pullTimeout) {
		console.log(`[${campus.name}]\tNot pulling because last pull was on ${new Date(campusDBs[campus.name].lastPull).toISOString()}, ${lastPullAgo / 1000 / 60} minutes ago. Timeout is ${env.pullTimeout / 1000 / 60} minutes`)
		return
	}
	console.log(`[${campus.name}] Starting pull...`)

	console.time(`[${campus.name}]\tPull took`)
	const newProjects: Project[] = []
	for (const id in env.projectIDs) {
		const item: Project = {
			name: id,
			users: await getProjectSubscribers(campus.id, env.projectIDs[id!])
		}
		console.log(`${new Date().toISOString()} [${campus.name}] [${id}]\ttotal users: ${item.users.length}`)
		newProjects.push(item)
	}
	campusDBs[campus.name].projects = newProjects
	console.timeEnd(`[${campus.name}]\tPull took`)
	await fs.promises.writeFile(campus.projectUsersPath, JSON.stringify(newProjects))
	await fs.promises.writeFile(campus.lastPullPath, String(Date.now()))
	campusDBs[campus.name].lastPull = parseInt((await fs.promises.readFile(campus.lastPullPath)).toString())
}

export async function saveAllProjectSubscribers() {
	console.time('complete pull took')
	for (const i in env.campuses) {
		await saveAllProjectSubscribersForCampus(env.campuses[i]!)
	}
	console.timeEnd('complete pull took')
}
