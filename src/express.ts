import path from 'path'
import express, { Response } from 'express'
import { passport, authenticate } from './authentication'
import { env, ProjectStatus } from './env'
import session from 'express-session'
import { log } from './logger'
import compression from 'compression'
// import request from 'request'
import cookieParser from 'cookie-parser'
import { DatabaseService } from './services'
import { displayProject } from './types'

async function errorPage(res: Response, error: string): Promise<void> {
	const settings = {
		campuses: await DatabaseService.getAllCampuses(),
		error,
	}
	res.render('error.ejs', settings)
}

const cachingProxy = '/proxy'

async function getUserCampusFromAPI(accessToken: string): Promise<{ campusId: number, campusName: string }> {
    try {
        const response = await fetch('https://api.intra.42.fr/v2/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user data from 42 API');
        }

        const userData = await response.json();
        const primaryCampus = userData.campus[0]; // User's primary campus

        return {
            campusId: primaryCampus.id,
            campusName: primaryCampus.name
        };
    } catch (error) {
        console.error('Error fetching user campus:', error);
        // Fallback to a default campus
        return { campusId: 14, campusName: 'Amsterdam' };
    }
}

async function getProjects(campusId: number, requestedStatus: string | undefined): Promise<displayProject[]> {
	const projectList = await DatabaseService.getAllProjects();
	if (!projectList.length) {
		return [];
	}
	const projectsWithUsers: displayProject[] = await Promise.all(projectList.map(async project => ({
		name: project.name,
		users: (await DatabaseService.getProjectUserInfo(project.id, campusId, requestedStatus)).map(projUser => ({
			login: projUser.user.login,
			image_url: projUser.user.image_url,
			status: projUser.status,
		})).sort((a, b) => {
			if (a.status !== b.status) {
				const preferredOrder = env.projectStatuses
				const indexA = preferredOrder.findIndex(x => x === a.status)
				const indexB = preferredOrder.findIndex(x => x === b.status)
				return indexA < indexB ? -1 : 1
			}
			return a.login < b.login ? -1 : 1
		})
	})));
	return projectsWithUsers.map(project => ({
		...project,
		users: project.users.filter(user => !user.login.match(/^3b3/) && !user.login.match(/^3c3/))
	}));
}

export async function startWebserver(port: number) {
	const app = express()

	// Add cookie parser middleware
	app.use(cookieParser())

	app.use(
		session({
			secret: env.tokens.userAuth.secret.slice(5),
			resave: false,
			saveUninitialized: true,
		})
	)
	app.use(passport.initialize())
	app.use(passport.session())



	// app.use(cachingProxy, (req, res) => {
	// 	const url = req.query['q']
	// 	if (!url || typeof url !== 'string' || !url.startsWith('http')) {
	// 		res.status(404).send('No URL provided')
	// 		return
	// 	}

	// 	// inject cache header for images
	// 	res.setHeader('Cache-Control', `public, max-age=${100 * 24 * 60 * 60}`)
	// 	req.pipe(request(url)).pipe(res)
	// })

	app.use(cachingProxy, async (req, res) => {
		const url = req.query['q']
		if (!url || typeof url !== 'string' || !url.startsWith('http')) {
			res.status(404).send('No URL provided')
			return
		}
		try {
			// inject cache header for images
			res.setHeader('Cache-Control', `public, max-age=${100 * 24 * 60 * 60}`)

			const response = await fetch(url)
			if (!response.ok) {
				res.status(404).send('Resource not found')
				return
			}

			// Copy headers
			response.headers.forEach((value, key) => {
				res.setHeader(key, value)
			})

			// Stream the response
			if (response.body) {
				// Convert web ReadableStream to Node.js stream
				const { Readable } = require('stream');
				Readable.fromWeb(response.body).pipe(res);
			}
		} catch (error) {
			console.error('Proxy error:', error)
			res.status(500).send('Proxy error')
		}
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

	app.get('/', authenticate, async (req, res) => {
		const user = req.user as any;
		const accessToken = user?.accessToken;

		if (!accessToken) {
			return errorPage(res, 'Access token not found for user');
		}

		res.redirect(`/${await getUserCampusFromAPI(accessToken).then(data => data.campusName)}`);
	})

	app.get('/:campus', authenticate, async (req, res) => {
		const user = req.user as any;
		const accessToken = user?.accessToken;
		if (!accessToken) {
			return errorPage(res, 'Access token not found for user');
		}
		let { campusId, campusName } = await getUserCampusFromAPI(accessToken);

		if (req.params['campus'] !== undefined) {
			campusName = req.params['campus'];
			campusId = await DatabaseService.getCampusIdByName(campusName);
			if (campusId === -1) {
				return errorPage(res, `Unknown campus ${campusName}`);
			}
		}

		const requestedStatus: string | undefined = req.query['status']?.toString()

		if (requestedStatus && !env.projectStatuses.includes(requestedStatus as ProjectStatus)) {
			return errorPage(res, `Unknown status ${req.query['status']}`)
		}

		const userTimeZone = req.cookies.timezone || 'Europe/Amsterdam'
		const settings = {
			projects: await getProjects(campusId, requestedStatus),
			users: await DatabaseService.getUsersByCampus(campusId),
			lastUpdate: await DatabaseService.getLastSyncTimestamp().then(date => date ? date.toLocaleString('en-NL', { timeZone: userTimeZone }).slice(0, -3) : 'N/A'),
			hoursAgo: (((Date.now()) - await DatabaseService.getLastSyncTimestamp().then(date => date ? date.getTime() : 0)) / (1000 * 60 * 60)).toFixed(2), // hours ago
			requestedStatus,
			projectStatuses: env.projectStatuses,
			campusName,
			campuses: await DatabaseService.getAllCampuses(),
			updateEveryHours: (env.pullTimeout / 1000 / 60 / 60).toFixed(0),
			userNewStatusThresholdDays: env.userNewStatusThresholdDays,
		}
		res.render('index.ejs', settings)
	})

	app.get('/status/pull', async (_, res) => {
		const lastSync = await DatabaseService.getLastSyncTimestamp();
		res.json(lastSync);
	})

	app.set('views', path.join(__dirname, '../views'))
	app.set('viewengine', 'ejs')
	app.use('/public', express.static('public/'))

	await app.listen(port)
	log(1, `${process.env['NODE_ENV'] ?? 'development'} app ready on http://localhost:${port}`)
}
