import { log } from './logger'
import fs from 'fs'
import path from 'path'

const tokens: Tokens = JSON.parse(fs.readFileSync('env/tokens.json').toString())
const campusIDs: { [key: string]: number }[] = JSON.parse(fs.readFileSync('env/campusIDs.json').toString())
const projectIDs: { [key: string]: number }[] = JSON.parse(fs.readFileSync('env/projectIDs.json').toString())

export interface Tokens {
	metricsSalt: string
	sync: {
		UID: string
		secret: string
		maxRequestPerSecond: number
	},
	userAuth: {
		UID: string
		secret: string
		callbackURL: string
	}
}

export interface Campus {
	name: string
	id: number
	databasePath: string // path to the database subfolder for this campus
	projectUsersPath: string // users that are subscribed to a project
	lastPullPath: string // timestamp for when the server did a last pull
}


export interface Env {
	logLevel: 0 | 1 | 2 | 3
	pullTimeout: number
	projectIDs: { [key: string]: number }[]
	databaseRoot: string
	campuses: Campus[]
	projectStatuses: typeof projectStatuses
	sessionStorePath: string // session key data
	userDBpath: string // users associated with sessions
	scope: string[]
	authorizationURL: string
	tokenURL: string
	provider: string
	authPath: string
	tokens: Tokens
	userNewStatusThresholdDays: number
}

const databaseRoot = 'database'
let campuses: Campus[] = []
for (const campusName in campusIDs) {
	const campus: Campus = {
		name: campusName,
		id: campusIDs[campusName!],
		databasePath: path.join(databaseRoot, campusName),
		projectUsersPath: path.join(databaseRoot, campusName, 'projectUsers.json'),
		lastPullPath: path.join(databaseRoot, campusName, 'lastpull.txt'),
	}
	campuses.push(campus)
}

// known statuses, in the order we want them displayed on the website
const projectStatuses = [
	'creating_group',
	'searching_a_group',
	'in_progress',
	'waiting_for_correction',
	'finished',
	'parent',
] as const
export type ProjectStatus = typeof projectStatuses[number]

export const env: Env = {
	logLevel: 1, // 0 being no logging
	pullTimeout: 24 * 60 * 60 * 1000, // how often to pull the project users statuses form the intra api (in Ms)
	projectIDs,
	databaseRoot,
	campuses,
	projectStatuses,
	sessionStorePath: path.join(databaseRoot, 'sessions'),
	authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
	tokenURL: 'https://api.intra.42.fr/oauth/token',
	userDBpath: path.join(databaseRoot, 'users.json'),
	provider: '42',
	authPath: '/auth/42',
	scope: ['public'],
	tokens,
	userNewStatusThresholdDays: 7,
}

log(1, `Watching ${Object.keys(campusIDs).length} campuses`)
log(1, `Watching ${Object.keys(projectIDs).length} projects`)
