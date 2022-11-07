import path from 'path'
import express from 'express'
import { passport, authenticate } from './authentication'
import { env } from './env'
import session from 'express-session'
import { campusDBs, CampusDB } from './db'
import { Project, UserProfile } from './types'
import { log, msToHuman } from './logger'
import { MetricsStorage } from './metrics'

function errorPage(res, error: string): void {
	const settings = {
		campuses: env.campuses.sort((a, b) => a.name < b.name ? -1 : 1),
		error
	}
	res.render('error.ejs', settings)
}

function filterProjects(projects: Project[], requestedStatus: string | undefined): Project[] {
	return projects.map(project => ({
		name: project.name,
		users: project.users.filter(user => {
			if (user.staff)
				return false
			if (user.login.match(/^3b3/)) // accounts who's login start with 3b3 are deactivated
				return false
			if ((requestedStatus == 'finished' || user.status != 'finished') && (!requestedStatus || user.status == requestedStatus))
				return true
			return false
		}).sort((a, b) => {
			if (a.status != b.status) {
				const preferredOrder = env.knownStatuses
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

let metrics = new MetricsStorage()

export async function startWebserver(port: number) {

	const app = express()

	// const FileStore = require('session-file-store')(session)
	// fs.mkdirSync(env.sessionStorePath, { recursive: true })
	// const fileStoreSettings = {
	// 	path: env.sessionStorePath,
	// 	retries: 1,
	// 	ttl: 7 * 24 * 60 * 60,
	// 	logFn: () => { },
	// }
	app.use(session({
		// store: new FileStore(fileStoreSettings),
		secret: env.tokens.userAuth.secret.slice(5),
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
		const requestedStatus: string | undefined = req.query['status']?.toString()

		const campusName = Object.keys(campusDBs).find(k => isLinguisticallySimilar(k, req.params['campus']))
		if (!campusName || !campusDBs[campusName])
			return errorPage(res, `Campus ${req.params['campus']} is not supported by Find Peers (yet)`)
		const campusDB: CampusDB = campusDBs[campusName]
		if (!campusDB.projects.length)
			return errorPage(res, "Empty database (please try again later)")

		if (requestedStatus && !env.knownStatuses.includes(requestedStatus))
			return errorPage(res, `Unknown status ${req.query['status']}`)

		const settings = {
			projects: filterProjects(campusDB.projects, requestedStatus),
			lastUpdate: (new Date(campusDB.lastPull)).toLocaleString('en-NL', { timeZone: user.timeZone }).slice(0, -3),
			hoursAgo: ((Date.now() - campusDB.lastPull) / 1000 / 60 / 60).toFixed(2),
			requestedStatus,
			knownStatuses: env.knownStatuses,
			campusName,
			campuses: env.campuses.sort((a, b) => a.name < b.name ? -1 : 1),
			updateEveryHours: (env.pullTimeout / 1000 / 60 / 60).toFixed(0)
		}
		res.render('index.ejs', settings)

		// saving anonymized metrics
		metrics.addVisitor(user.accessToken, user.campusName)
	})

	app.get('/status/pull', (req, res) => {
		const obj: { name: string, lastPull: Date, ago: string }[] = []
		for (const campus of Object.keys(campusDBs))
			obj.push({ name: campus, lastPull: new Date(campusDBs[campus!].lastPull), ago: msToHuman(Date.now() - campusDBs[campus!].lastPull) })
		res.send(JSON.stringify(obj))
	})

	app.get('/status/metrics', authenticate, (req, res) => {
		res.send(JSON.stringify(metrics.generateMetrics()))
	})

	app.set("views", path.join(__dirname, "../views"))
	app.set('viewengine', 'ejs')
	app.use('/public', express.static('public/'))

	await app.listen(port)
	log(1, `app ready on port port ${port}`)
}
