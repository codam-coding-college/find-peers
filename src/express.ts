import path from 'path'
import express, { Response } from 'express'
import { passport, authenticate } from './authentication'
import { env, ProjectStatus } from './env'
import session from 'express-session'
import { log } from './logger'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { DatabaseService } from './services'
import { DisplayProject } from './types'

/**
 * Render the error page.
 * @param res The response object
 * @param error The error message to display
 */
async function errorPage(res: Response, error: string): Promise<void> {
	const settings = {
		// Hide the Ghost Campus (id 42) from the selectable list of campuses in the dropdown (website header)
		campuses: (await DatabaseService.getAllCampuses()).filter(c => c.id !== 42),
		error,
	}
	res.render('error.ejs', settings);
}

/**
 * Get the projects for a specific campus and status.
 * @param campusId The ID of the campus
 * @param requestedStatus The status of the projects to retrieve
 * @returns A list of projects for the specified campus and status, sorted on status.
 */
async function getProjects(campusId: number, requestedStatus: string | undefined, showEmptyProjects: boolean): Promise<DisplayProject[]> {
	const projectList = await DatabaseService.getAllProjects();
	if (!projectList.length) {
		return [];
	}
	const projectsWithUsers: DisplayProject[] = await Promise.all(projectList.map(async project => ({
		name: project.name,
		slug: project.slug,
		users: (await DatabaseService.getProjectUserInfo(project.id, campusId, requestedStatus)).map(projUser => ({
			login: projUser.user.login,
			image_url: projUser.user.image_url,
			status: projUser.status,
			pool: projUser.user.pool ? projUser.user.pool : 'N/A',
			new: (Date.now() - new Date(projUser.created_at).getTime()) < env.userNewStatusThresholdDays * 24 * 60 * 60 * 1000,
		})).sort((a, b) => {
			if (a.status !== b.status) {
				const preferredOrder = env.projectStatuses;
				const indexA = preferredOrder.findIndex(x => x === a.status);
				const indexB = preferredOrder.findIndex(x => x === b.status);
				return indexA < indexB ? -1 : 1;
			}
			return a.login < b.login ? -1 : 1;
		})
	})));
	const filteredProjects = projectsWithUsers.map(project => ({
		...project,
		users: project.users.filter(user => !user.login.match(/^3b3/) && !user.login.match(/^3c3/))
	}));
	return showEmptyProjects
		? filteredProjects
		: filteredProjects.filter(project => project.users.length > 0);
}

/**
 * Start the web server.
 * @param port The port to listen on
 */
export async function startWebserver(port: number) {
	const app = express();

	// Add cookie parser middleware
	app.use(cookieParser());

	app.use(
		session({
			secret: env.tokens.userAuth.secret.slice(5),
			resave: false,
			saveUninitialized: true,
		})
	);
	app.use(passport.initialize());
	app.use(passport.session());

	// Compression middleware
	app.use((req, res, next) => {
		try {
			compression()(req, res, next);
			return;
		} catch (e) {
			console.error('Compression error', e);
		}
		next();
	})

	// Robots.txt
	app.get('/robots.txt', (_, res) => {
		res.type('text/plain');
		res.send('User-agent: *\nAllow: /');
	});

	// Authentication routes
	app.get(`${env.authPath}/`, passport.authenticate(env.provider, { scope: env.scope }));
	app.get(
		`${env.authPath}/callback`,
		passport.authenticate(env.provider, {
			successRedirect: '/',
			failureRedirect: `${env.authPath}`,
		})
	);

	// Login route (expired token, no token)
	app.get('/login', (_, res) => {
		// go to login page
		res.render('login.ejs');
	});

	// Main route
	app.get('/', async (req, res) => {
		if (!req.isAuthenticated() || !req.user) {
			return res.redirect('/login');
		}

		const user = req.user as any;
		const accessToken = user?.accessToken;

		if (!accessToken) {
			return errorPage(res, 'Access token not found for user');
		}

		const campus = await DatabaseService.getCampusByUser(user.login);
		if (!campus) {
			return errorPage(res, 'User campus not found in database');
		}
		res.redirect(`/${campus.name}`);
	});

	// Campus-specific route
	app.get('/:campus', authenticate, async (req, res) => {
		const user = req.user as any;
		const accessToken = user?.accessToken;
		if (!accessToken) {
			return errorPage(res, 'Access token not found for user');
		}

		// Campus to use if none is provided. (User's primary campus)
		const campus = await DatabaseService.getCampusByUser(user.login);
		if (!campus) {
			return errorPage(res, 'User campus not found in database');
		}

		// If a campus is explicitly provided, use that one
		if (req.params['campus'] !== undefined) {
			campus.name = req.params['campus'];
			campus.id = await DatabaseService.getCampusIdByName(campus.name);
			if (campus.id === -1) {
				return errorPage(res, `Unknown campus ${campus.name}`);
			}
		}

		const requestedStatus: string | undefined = req.query['status']?.toString();
		if (requestedStatus && !env.projectStatuses.includes(requestedStatus as ProjectStatus)) {
			return errorPage(res, `Unknown status ${req.query['status']}`);
		}

		const showEmptyProjects: boolean = req.query['showEmptyProjects'] === '1';

		// Get all necessary data to be displayed to the user
		const userTimeZone = req.cookies.timezone || 'Europe/Amsterdam';
		const settings = {
			projects: await getProjects(campus.id, requestedStatus, showEmptyProjects),
			lastUpdate: await DatabaseService.getLastSyncTimestamp().then(date => date ? date.toLocaleString('en-NL', { timeZone: userTimeZone }).slice(0, -3) : 'N/A'),
			hoursAgo: (((Date.now()) - await DatabaseService.getLastSyncTimestamp().then(date => date ? date.getTime() : 0)) / (1000 * 60 * 60)).toFixed(2), // hours ago
			requestedStatus,
			projectStatuses: env.projectStatuses,
			campusName: campus.name,
			// Hide the Ghost Campus (id 42) from the selectable list of campuses in the dropdown (website header)
			campuses: (await DatabaseService.getAllCampuses()).filter(c => c.id !== 42),
			updateEveryHours: (env.pullTimeout / 1000 / 60 / 60).toFixed(0),
			userNewStatusThresholdDays: env.userNewStatusThresholdDays,
			showEmptyProjects,
		};
		res.render('index.ejs', settings);
	});

	app.set('views', path.join(__dirname, '../views'));
	app.set('view engine', 'ejs');
	app.use('/public', express.static('public/'));

	await app.listen(port);
	log(1, `${process.env['NODE_ENV'] ?? 'development'} app ready on http://localhost:${port}`);
}
