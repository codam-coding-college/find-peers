import path from 'path'
import express from 'express'
import { passport, authenticate } from './authentication'
import { env, ProjectStatus } from './env'
import session from 'express-session'
import { campusDBs, CampusDB } from './db'
import { Project, ProjectSubscriber, UserProfile } from './types'
import { log } from './logger'
import { MetricsStorage } from './metrics'
import compression from 'compression'
import request from 'request'

function errorPage(res, error: string): void {
	const settings = {
		campuses: env.campuses.sort((a, b) => a.name < b.name ? -1 : 1),
		error
	}
	res.render('error.ejs', settings)
}

const cachingProxy = '/proxy'

function filterUsers(users: ProjectSubscriber[], requestedStatus: string | undefined): ProjectSubscriber[] {
	const newUsers = users
		.filter(user => {
			if (user.staff)
				return false
			if (user.login.match(/^3b3/)) // accounts who's login start with 3b3 are deactivated
				return false
			if ((requestedStatus == 'finished' || user.status != 'finished') && (!requestedStatus || user.status == requestedStatus))
				return true
			return false
		})
		.map(user => (
			{ ...user, image_url: `${cachingProxy}?q=${user.image_url}` }
		))
		.sort((a, b) => {
			if (a.new != b.new)
				return a.new ? -1 : 1

			if (a.status != b.status) {
				const preferredOrder = env.projectStatuses
				const indexA = preferredOrder.findIndex(x => x == a.status)
				const indexB = preferredOrder.findIndex(x => x == b.status)
				return indexA < indexB ? -1 : 1
			}
			return a.login < b.login ? -1 : 1
		})
	return newUsers
}

function filterProjects(projects: Project[], requestedStatus: string | undefined): Project[] {
	return projects.map(project => ({
		name: project.name,
		users: filterUsers(project.users, requestedStatus)
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

	app.use(session({
		secret: env.tokens.userAuth.secret.slice(5),
		resave: false,
		saveUninitialized: true
	}))
	app.use(passport.initialize())
	app.use(passport.session())

	app.use(cachingProxy, (req, res) => {
		// inject cache header for images
		res.setHeader('Cache-Control', `public, max-age=${100 * 24 * 60 * 60}`)
		const url = req.query['q'] ?? ''
		req.pipe(request(url)).pipe(res)
	})

	app.use((req, res, next) => {
		try {
			compression()(req, res, next)
			return
		} catch (e) {
			console.error('Compression error', e)
		}
		next()
	})

	app.get('/robots.txt', (req, res) => {
		res.type('text/plain')
		res.send('User-agent: *\nAllow: /')
	})

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

		if (requestedStatus && !env.projectStatuses.includes(requestedStatus as ProjectStatus))
			return errorPage(res, `Unknown status ${req.query['status']}`)

		const { uniqVisitorsTotal: v, uniqVisitorsCampus } = metrics.generateMetrics()
		const campuses = uniqVisitorsCampus.reduce((acc, visitors) => acc += visitors.month > 0 ? 1 : 0, 0)
		const settings = {
			projects: filterProjects(campusDB.projects, requestedStatus),
			lastUpdate: (new Date(campusDB.lastPull)).toLocaleString('en-NL', { timeZone: user.timeZone }).slice(0, -3),
			hoursAgo: ((Date.now() - campusDB.lastPull) / 1000 / 60 / 60).toFixed(2),
			requestedStatus,
			projectStatuses: env.projectStatuses,
			campusName,
			campuses: env.campuses.sort((a, b) => a.name < b.name ? -1 : 1),
			updateEveryHours: (env.pullTimeout / 1000 / 60 / 60).toFixed(0),
			usage: `${v.day} unique visitors today, ${v.month} this month, from ${campuses} different campuses`,
			userNewStatusThresholdDays: env.userNewStatusThresholdDays,
		}
		res.render('index.ejs', settings)

		// saving anonymized metrics
		metrics.addVisitor(user)
	})

	app.get('/status/pull', (req, res) => {
		const obj = Object.keys(campusDBs).map(campus => ({
			name: campus,
			lastPull: new Date(campusDBs[campus!].lastPull),
			hoursAgo: (Date.now() - campusDBs[campus!].lastPull) / 1000 / 60 / 60
		}))
		res.json(obj)
	})

	app.get('/status/metrics', authenticate, (req, res) => {
		res.json(metrics.generateMetrics())
	})

	app.set("views", path.join(__dirname, "../../views"))
	app.set('viewengine', 'ejs')
	app.use('/public', express.static('public/'))

	await app.listen(port)
	log(1, `app ready on port port ${port}`)
}
