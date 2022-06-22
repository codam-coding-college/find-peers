import fs from 'fs'
import { API } from '42-connector'
import { User, Project, ProjectSubscriber } from './types'
import { env, Campus } from './env'
import { logCampus, log, msToHuman, nowISO } from './logger'

const Api: API = new API(
	env.tokens.sync.UID,
	env.tokens.sync.secret,
	{
		maxRequestPerSecond: env.tokens.sync.maxRequestPerSecond,
		logging: env.logLevel >= 3
	}
)

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
	const { ok, json: users }: { ok: boolean, json?: User[] } = await Api.getPaged(
		`/v2/projects/${projectID}/projects_users?filter[campus]=${campusID}`,
		// (data) => console.log(data)
	)
	if (!ok)
		throw "Could not get project subscribers"
	const projectSubscribers: ProjectSubscriber[] = []
	for (const x of users!) {
		try {
			const valid = {
				login: x.user.login,
				status: x.status,
				staff: x.user['staff?'],
			}
			projectSubscribers.push(valid)
		} catch (e) { }
	}
	return projectSubscribers
}

// @return number of users pulled
export async function saveAllProjectSubscribers(campus: Campus): Promise<number> {
	let usersPulled: number = 0
	const startPull = Date.now()
	const newProjects: Project[] = []
	for (const id in env.projectIDs) {
		let item: Project
		try {
			item = {
				name: id,
				users: await getProjectSubscribers(campus.id, env.projectIDs[id!])
			}
		} catch (e) { return 0 }
		usersPulled += item.users.length
		logCampus(2, campus.name, id, `total users: ${item.users.length}`)
		newProjects.push(item)
	}
	campusDBs[campus.name].projects = newProjects
	log(2, `Pull took ${msToHuman(Date.now() - startPull)}`)

	await fs.promises.writeFile(campus.projectUsersPath, JSON.stringify(newProjects))
	await fs.promises.writeFile(campus.lastPullPath, String(Date.now()))
	campusDBs[campus.name].lastPull = parseInt((await fs.promises.readFile(campus.lastPullPath)).toString())
	return usersPulled
}

// Sync all user statuses form all campuses if the env.pullTimeout for that campus has not been reached
export async function syncCampuses(): Promise<void> {
	const startPull = Date.now()

	log(1, 'starting pull')
	for (const campus of env.campuses) {
		const lastPullAgo = Date.now() - campusDBs[campus.name].lastPull
		logCampus(2, campus.name, '', `last pull was on ${nowISO(campusDBs[campus.name].lastPull)}, ${(lastPullAgo / 1000 / 60).toFixed(0)} minutes ago. `)
		if (lastPullAgo < env.pullTimeout) {
			logCampus(2, campus.name, '', `not pulling, timeout of ${env.pullTimeout / 1000 / 60} minutes not reached`)
			continue
		}
		await saveAllProjectSubscribers(campus)
	}
	log(1, `complete pull took ${msToHuman(Date.now() - startPull)}`)
}
