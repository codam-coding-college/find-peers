import path from 'path'
import express from 'express'
import { passport, authenticate } from './authentication'
import { env } from './env'
import session from 'express-session'
import { projects, lastPull } from './db'

export async function startWebserver(port: number) {

	const app = express()
	app.use(passport.initialize())

	const FileStore = require('session-file-store')(session);
	const fileStoreSettings = {
		path: './sessions',
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
		const projectsFiltered = projects.map(project => ({
			name: project.name,
			users: project.users.filter(user => !(user.status == 'finished')).sort((a, b) => (a.status < b.status) ? -1 : 1)
		}))

		const settings = {
			projects: projectsFiltered,
			lastUpdate: (new Date(lastPull)).toLocaleString('en-NL', { timeZone: 'Europe/Amsterdam' }),
		}
		res.render('index.ejs', settings)
	})

	app.set("views", path.join(__dirname, "../views"))
	app.set('viewengine', 'ejs')
	app.use(express.static('public/'))

	await app.listen(port)
	console.log('app ready on port', port)
}
