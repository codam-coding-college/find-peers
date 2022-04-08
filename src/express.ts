import path from 'path'
import express from 'express'
import { passport, authenticate } from './authentication'
import { env } from './env'
import session from 'express-session'
import { campusDBs, CampusDB } from './db'
import fs from 'fs'
import { Project, UserProfile } from './types'
import { log, msToHuman } from './logger'

const known_statuses = [
	'creating_group',
	'searching_a_group',
	'in_progress',
	'waiting_for_correction',
	'finished',
]

function errorPage(res, error: string): void {
	const settings = {
		campuses: env.campuses.sort((a, b) => a.name < b.name ? -1 : 1),
		error
	}
	res.render('error.ejs', settings)
}

function filterProjects(projects: Project[], query?: {status: string[], projects: string[]}): Project[] {
	return projects.filter((project) => {
		if (query === undefined || query.projects[0] == "" || query?.projects.find(x => x == project.name))
			return true;
		return false;
	}).map(project => ({
		name: project.name,
		users: project.users.filter((user) => {
			if (user.status != 'finished' && (query === undefined || query.status.length == 0 || query.status.find(x => x == user.status)))
				return true;
			if (query?.status.find(x => x == "other") && known_statuses.find(x => x == user.status) == undefined)
				return true;
			return false;
			}).sort((a, b) => {
			if (a.status != b.status) {
				const preferredOrder = [
					'creating_group',
					'searching_a_group',
					'in_progress',
					'waiting_for_correction',
					'finished',
					'parent'
				]
				const indexA = preferredOrder.findIndex(x => x == a.status)
				const indexB = preferredOrder.findIndex(x => x == b.status)
				return indexA < indexB ? -1 : 1
			}
			return a.login < b.login ? -1 : 1
		})
	}))
}


// ignoring case, whitespace, -, _, non ascii chars
function isLinguisticallySimilar(a: string, b: string): boolean {
	a = a.toLowerCase().replace(/\s|-|_/g, '').normalize('NFKD').replace(/[\u0300-\u036F]/g, '')
	b = b.toLowerCase().replace(/\s|-|_/g, '').normalize('NFKD').replace(/[\u0300-\u036F]/g, '')
	return a == b
}

export async function startWebserver(port: number) {

	const app = express()

	const FileStore = require('session-file-store')(session)
	fs.mkdirSync(env.sessionStorePath, { recursive: true })
	const fileStoreSettings = {
		path: env.sessionStorePath,
		retries: 1,
		ttl: 7 * 24 * 60 * 60,
		logFn: () => { },
	}
	app.use(session({
		store: new FileStore(fileStoreSettings),
		secret: env.clientSecret.slice(5),
		resave: false,
		saveUninitialized: true
	}))
	app.use(passport.initialize())
	app.use(passport.session())

	app.get(`/auth/${env.provider}/`, passport.authenticate(env.provider, { scope: env.scope }))
	app.get(`/auth/${env.provider}/callback`,
		passport.authenticate(env.provider, {
			successRedirect: '/',
			failureRedirect: `/auth/${env.provider}`,
		}))

	app.use(express.json({type: "*/*" }));
	app.post('/api/projects', async (req, res) => {
		const params = req.body;

		const campusName = params.campus;
		if (!campusName || !campusDBs[campusName])
		{
			res.statusCode = 500;
			res.send("Unknown campus");
		}
		const campusDB: CampusDB = campusDBs[campusName]
		if (!campusDB.projects.length)
			return errorPage(res, "Empty database (please try again later)")

		res.send(filterProjects(campusDB.projects, params));
	});

	app.get('/api/general', async (req, res) => {
		const user: UserProfile = req!.user as UserProfile
		const campusDB: CampusDB = campusDBs[user.campusName];

		res.send({
			userCampus: user.campusName,
			projects: campusDB.projects.map((proj) => proj.name),
			lastUpdate: (new Date(campusDB.lastPull)).toLocaleString('en-NL', { timeZone: user.timeZone }).slice(0, -3),
			hoursAgo: ((Date.now() - campusDB.lastPull) / 1000 / 60 / 60).toFixed(2),
			campuses: env.campuses.sort((a, b) => a.name < b.name ? -1 : 1),
			updateEveryHours: (env.pullTimeout / 1000 / 60 / 60).toFixed(0)
		})
	});

	app.get('/status/pull', authenticate, (req, res) => {
		const obj: { name: string, lastPull: Date, ago: string }[] = []
		for (const campus of Object.keys(campusDBs))
			obj.push({ name: campus, lastPull: new Date(campusDBs[campus!].lastPull), ago: msToHuman(Date.now() - campusDBs[campus!].lastPull) })
		res.send(JSON.stringify(obj))
	})

	app.set("views", path.join(__dirname, "../views"))
	app.set('viewengine', 'ejs')
	app.use('/public', express.static('public/'))
	app.use('/', express.static('frontend/'))

	await app.listen(port)
	log(1, `app ready on port port ${port}`)
}
