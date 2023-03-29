import path from 'path'
import express, { Response } from 'express'
import { passport, authenticate } from './authentication'
import { CampusName, env, ProjectStatus } from './env'
import session from 'express-session'
import { campusDBs, CampusDB } from './db'
import { Project, ProjectSubscriber, UserProfile } from './types'
import { log } from './logger'
import { MetricsStorage } from './metrics'
import compression from 'compression'
import request from 'request'
import { isLinguisticallySimilar } from './util'

function errorPage(res: Response, error: string): void {
	const settings = {
		campuses: Object.values(env.campuses).sort((a, b) => (a.name < b.name ? -1 : 1)),
		error,
	}
	res.render('error.ejs', settings)
}

const cachingProxy = '/proxy'

function filterUsers(users: ProjectSubscriber[], requestedStatus: string | undefined): ProjectSubscriber[] {
	const newUsers = users
		.filter(user => {
			if (user.staff) {
				return false
			}
			if (user.login.match(/^3b3/)) {
				// accounts who's login start with 3b3 are deactivated
				return false
			}
			if ((requestedStatus === 'finished' || user.status !== 'finished') && (!requestedStatus || user.status === requestedStatus)) {
				return true
			}
			return false
		})
		.map(user => ({ ...user, image_url: `${cachingProxy}?q=${user.image_url}` }))
		.sort((a, b) => {
			if (a.status !== b.status) {
				const preferredOrder = env.projectStatuses
				const indexA = preferredOrder.findIndex(x => x === a.status)
				const indexB = preferredOrder.findIndex(x => x === b.status)
				return indexA < indexB ? -1 : 1
			}
			return a.login < b.login ? -1 : 1
		})
	return newUsers
}

function filterProjects(projects: Project[], requestedStatus: string | undefined): Project[] {
	return projects.map(project => ({
		name: project.name,
		users: filterUsers(project.users, requestedStatus),
	}))
}

const metrics = new MetricsStorage()

export async function startWebserver(port: number) {
	const app = express()

	app.use(
		session({
			secret: env.tokens.userAuth.secret.slice(5),
			resave: false,
			saveUninitialized: true,
		})
	)
	app.use(passport.initialize())
	app.use(passport.session())

	app.use(cachingProxy, (req, res) => {
		const url = req.query['q']
		if (!url || typeof url !== 'string' || !url.startsWith('http')) {
			res.status(404).send('No URL provided')
			return
		}

		// inject cache header for images
		res.setHeader('Cache-Control', `public, max-age=${100 * 24 * 60 * 60}`)
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

	app.get('/robots.txt', (_, res) => {
		res.type('text/plain')
		res.send('User-agent: *\nAllow: /')
	})

	app.get(`/auth/${env.provider}/`, passport.authenticate(env.provider, { scope: env.scope }))
	app.get(
		`/auth/${env.provider}/callback`,
		passport.authenticate(env.provider, {
			successRedirect: '/',
			failureRedirect: `/auth/${env.provider}`,
		})
	)

	app.get('/', authenticate, (req, res) => {
		const user: UserProfile = req.user as UserProfile
		res.redirect(`/${user.campusName}`)
	})

	app.get('/:campus', authenticate, (req, res) => {
		const user: UserProfile = req.user as UserProfile
		const requestedStatus: string | undefined = req.query['status']?.toString()

		const campus = req.params['campus'] as string
		const campusName: CampusName | undefined = Object.keys(campusDBs).find(k => isLinguisticallySimilar(k, campus)) as CampusName | undefined
		if (!campusName || !campusDBs[campusName]) {
			return errorPage(res, `Campus ${campus} is not supported by Find Peers (yet)`)
		}

		// saving anonymized metrics
		metrics.addVisitor(user)

		const campusDB: CampusDB = campusDBs[campusName]
		if (!campusDB.projects.length) {
			return errorPage(res, 'Empty database (please try again later)')
		}

		if (requestedStatus && !env.projectStatuses.includes(requestedStatus as ProjectStatus)) {
			return errorPage(res, `Unknown status ${req.query['status']}`)
		}

		const { uniqVisitorsTotal: v, uniqVisitorsCampus } = metrics.generateMetrics()
		const campuses = uniqVisitorsCampus.reduce((acc, visitors) => {
			acc += visitors.month > 0 ? 1 : 0
			return acc
		}, 0)
		const settings = {
			projects: filterProjects(campusDB.projects, requestedStatus),
			lastUpdate: new Date(campusDB.lastPull).toLocaleString('en-NL', { timeZone: user.timeZone }).slice(0, -3),
			hoursAgo: ((Date.now() - campusDB.lastPull) / 1000 / 60 / 60).toFixed(2),
			requestedStatus,
			projectStatuses: env.projectStatuses,
			campusName,
			campuses: Object.values(env.campuses).sort((a, b) => (a.name < b.name ? -1 : 1)),
			updateEveryHours: (env.pullTimeout / 1000 / 60 / 60).toFixed(0),
			usage: `${v.day} unique visitors today, ${v.month} this month, from ${campuses} different campuses`,
			userNewStatusThresholdDays: env.userNewStatusThresholdDays,
		}
		res.render('index.ejs', settings)
	})

	app.get('/status/pull', (_, res) => {
		const obj = Object.values(campusDBs).map(campus => ({
			name: campus.name,
			lastPull: new Date(campus.lastPull),
			hoursAgo: (Date.now() - campus.lastPull) / 1000 / 60 / 60,
		}))
		res.json(obj)
	})

	app.get('/status/metrics', authenticate, (_, res) => {
		res.json(metrics.generateMetrics())
	})

	app.set('views', path.join(__dirname, '../views'))
	app.set('viewengine', 'ejs')
	app.use('/public', express.static('public/'))

	await app.listen(port)
	log(1, `${process.env['NODE_ENV'] ?? 'development'} app ready on http://localhost:${port}`)
}
