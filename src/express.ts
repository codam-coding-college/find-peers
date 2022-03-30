import path from 'path'
import express from 'express'
import { passport, authenticate } from './authentication'
import { env } from './env'
import session from 'express-session'
import { campusDBs, CampusDB } from './db'
import fs from 'fs'
import { Project, UserProfile } from './types'
import { log } from './logger'

function errorPage(res, error: string): void {
	const settings = {
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
		const user = req.user as UserProfile | null
		if (!user?.campusName)
			return errorPage(res, "This should never happen (authentication failure)")
		const campusDB: CampusDB = campusDBs[user.campusName]
		if (!campusDB)
			return errorPage(res, "Your (primary) campus is not supported by Find Peers (yet)")
		if (!campusDB.projects.length)
			return errorPage(res, "Empty database (please try again later)")

		const settings = {
			projects: filterProjects(campusDB.projects),
			lastUpdate: (new Date(campusDB.lastPull)).toLocaleString('en-NL', { timeZone: user.timeZone }).slice(0, -3),
			hoursAgo: ((Date.now() - campusDB.lastPull) / 1000 / 60 / 60).toFixed(2),
		}
		res.render('index.ejs', settings)
	})

	app.set("views", path.join(__dirname, "../views"))
	app.set('viewengine', 'ejs')
	app.use(express.static('public/'))

	await app.listen(port)
	log(1, `app ready on port port ${port}`)
}
