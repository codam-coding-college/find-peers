import path from 'path'
import express from 'express'
import { passport, authenticate } from './authentication'
import { env } from './env'
import session from 'express-session'
import { campusDBs, CampusDB } from './db'
import fs from 'fs'
import { Project, UserProfile } from './types'
import { log, msToHuman } from './logger'

function errorPage(res, error: string): void {
	const settings = {
		campuses: env.campuses.sort((a, b) => a.name < b.name ? -1 : 1),
		error
	}
	res.render('error.ejs', settings)
}

function filterProjects(projects: Project[]): Project[] {
	return projects.map(project => ({
		name: project.name,
		users: project.users.filter(user => !(user.status == 'finished')).sort((a, b) => {
			if (a.status != b.status) {
				const preferredOrder = [
					'searching_a_group',
					'in_progress',
					'waiting_for_correction',
					'finished'
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

	app.get('/', authenticate, async (req, res) => {
		const user: UserProfile = req!.user as UserProfile
		res.redirect(`/${user.campusName}`)
	})

	app.get('/:campus', authenticate, async (req, res) => {
		const user: UserProfile = req!.user as UserProfile

		const campusName = Object.keys(campusDBs).find(k => isLinguisticallySimilar(k, req.params['campus']))
		if (!campusName || !campusDBs[campusName])
			return errorPage(res, `Campus ${req.params['campus']} is not supported by Find Peers (yet)`)
		const campusDB: CampusDB = campusDBs[campusName]
		if (!campusDB.projects.length)
			return errorPage(res, "Empty database (please try again later)")

		const settings = {
			projects: filterProjects(campusDB.projects),
			lastUpdate: (new Date(campusDB.lastPull)).toLocaleString('en-NL', { timeZone: user.timeZone }).slice(0, -3),
			hoursAgo: ((Date.now() - campusDB.lastPull) / 1000 / 60 / 60).toFixed(2),
			campusName,
			campuses: env.campuses.sort((a, b) => a.name < b.name ? -1 : 1),
			updateEveryHours: (env.pullTimeout / 1000 / 60 / 60).toFixed(0)
		}
		res.render('index.ejs', settings)
	})

	app.get('/status/pull', authenticate, (req, res) => {
		const obj: { name: string, lastPull: Date, ago: string }[] = []
		for (const campus of Object.keys(campusDBs))
			obj.push({ name: campus, lastPull: new Date(campusDBs[campus!].lastPull), ago: msToHuman(Date.now() - campusDBs[campus!].lastPull) })
		res.send(JSON.stringify(obj))
	})

	app.set("views", path.join(__dirname, "../views"))
	app.set('viewengine', 'ejs')
	app.use(express.static('public/'))

	await app.listen(port)
	log(1, `app ready on port port ${port}`)
}
