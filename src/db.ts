import fs from 'fs'
import { API } from '42-connector'
import { ApiProject, Project, ProjectSubscriber, projectStatuses, ApiProjectUser } from './types'
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

function toProjectSubscriber(x: ApiProject): ProjectSubscriber | null {
	try {
		const valid = {
			login: x.user.login,
			status: projectStatuses.includes(x.status) ? x.status : 'finished',
			staff: x.user['staff?'],
			image_url: x.user.image.versions.medium,
		}
		// overwriting Intra's wrong key
		if (x['validated?'] &&
			['waiting_for_correction', 'in_progress', 'searching_a_group', 'creating_group'].includes(x.status))
			valid.status = 'finished'

		return valid
	} catch (e) {
		console.error(e)
		return null
	}
}

export async function getProjectSubscribers(campusID: number, projectID: number): Promise<ProjectSubscriber[]> {
	const { ok, json: users }: { ok: boolean, json?: ApiProject[] } = await Api.getPaged(
		`/v2/projects/${projectID}/projects_users?filter[campus]=${campusID}&page[size]=100`,
		// (data) => console.log(data)
	)
	if (!ok)
		throw new Error('Could not get project subscribers')
	return users!.map(toProjectSubscriber).filter(x => !!x) as ProjectSubscriber[]
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
