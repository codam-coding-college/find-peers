import fs from 'fs'
import { API } from '42-connector'
import { ApiProject, Project, ProjectSubscriber } from './types'
import { env, Campus, ProjectStatus, CampusName } from './env'
import { logCampus, log, msToHuman, nowISO } from './logger'

const Api: API = new API(env.tokens.sync.UID, env.tokens.sync.secret, {
	maxRequestPerSecond: env.tokens.sync.maxRequestPerSecond,
	logging: env.logLevel >= 3,
})

export interface CampusDB {
	name: CampusName
	projects: Project[]
	lastPull: number
}

export const campusDBs: Record<CampusName, CampusDB> = {} as Record<CampusName, CampusDB>

fs.mkdirSync(env.databaseRoot, { recursive: true })
function setupCampusDB(campus: Campus) {
	const campusDB: CampusDB = {
		name: campus.name,
		projects: [],
		lastPull: 0,
	}

	fs.mkdirSync(campus.databasePath, { recursive: true })
	if (!fs.existsSync(campus.projectUsersPath)) fs.writeFileSync(campus.projectUsersPath, '[]')
	campusDB.projects = JSON.parse(fs.readFileSync(campus.projectUsersPath).toString())
	if (!fs.existsSync(campus.lastPullPath)) fs.writeFileSync(campus.lastPullPath, '0')
	campusDB.lastPull = parseInt(fs.readFileSync(campus.lastPullPath).toString())
	campusDBs[campus.name] = campusDB
}

for (const campus of Object.values(env.campuses)) {
	setupCampusDB(campus)
}

// Next time we use SQL
function findProjectUserByLogin(login: string, projectName: string): ProjectSubscriber | undefined {
	for (const campus of Object.values(env.campuses)) {
		const projects = campusDBs[campus.name].projects as Project[]
		for (const project of projects) {
			if (project.name !== projectName) continue
			const user = project.users.find(x => x.login === login)
			if (user) return user
		}
	}
	return undefined
}

function getUpdate(status: ProjectStatus, existingUser?: ProjectSubscriber): { new: boolean; lastChangeD: Date } {
	if (!existingUser) return { new: true, lastChangeD: new Date() }

	if (status !== existingUser.status) return { new: true, lastChangeD: new Date() }

	const lastChangeD = new Date(existingUser.lastChangeD)
	const isNew = Date.now() - lastChangeD.getTime() < env.userNewStatusThresholdDays * 24 * 60 * 60 * 1000
	return { new: isNew, lastChangeD: lastChangeD }
}

// Intra's 'validated' key is sometimes wrong, therefore we use our own logic
function getStatus(x: Readonly<ApiProject>): ProjectStatus {
	let status: ProjectStatus = x['validated?'] ? 'finished' : x.status

	if (!env.projectStatuses.includes(x.status)) {
		console.error(`Invalid status: ${x.status} on user ${x.user}`)
		status = 'finished'
	}
	return status
}

function toProjectSubscriber(x: Readonly<ApiProject>, projectName: string): ProjectSubscriber | undefined {
	try {
		const status = getStatus(x)
		const existing = findProjectUserByLogin(x.user.login, projectName)
		const valid: ProjectSubscriber = {
			login: x.user.login,
			status,
			staff: !!x.user['staff?'],
			image_url: x.user.image.versions.medium,
			...getUpdate(status, existing),
		}
		return valid
	} catch (e) {
		console.error(e)
		return undefined
	}
}

export async function getProjectSubscribers(campusID: number, projectID: number, projectName: string): Promise<ProjectSubscriber[]> {
	const { ok, json: users }: { ok: boolean; json?: ApiProject[] } = await Api.getPaged(
		`/v2/projects/${projectID}/projects_users?filter[campus]=${campusID}&page[size]=100`
		// (data) => console.log(data)
	)
	if (!ok || !users) throw new Error('Could not get project subscribers')
	return users.map(u => toProjectSubscriber(u, projectName)).filter(x => !!x) as ProjectSubscriber[]
}

// @return number of users pulled
export async function saveAllProjectSubscribers(campus: Campus): Promise<number> {
	let usersPulled = 0
	const startPull = Date.now()
	const newProjects: Project[] = []
	for (const [name, id] of Object.entries(env.projectIDs)) {
		let item: Project
		try {
			item = {
				name,
				users: await getProjectSubscribers(campus.id, id, name),
			}
		} catch (e) {
			return 0
		}
		usersPulled += item.users.length
		logCampus(2, campus.name, name, `total users: ${item.users.length}`)
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
	for (const campus of Object.values(campusDBs)) {
		const lastPullAgo = Date.now() - campus.lastPull
		logCampus(2, campus.name, '', `last pull was on ${nowISO(campus.lastPull)}, ${(lastPullAgo / 1000 / 60).toFixed(0)} minutes ago`)
		if (lastPullAgo < env.pullTimeout) {
			logCampus(2, campus.name, '', `not pulling, timeout of ${env.pullTimeout / 1000 / 60} minutes not reached`)
			continue
		}
		await saveAllProjectSubscribers(env.campuses[campus.name])
	}
	log(1, `complete pull took ${msToHuman(Date.now() - startPull)}`)
}
