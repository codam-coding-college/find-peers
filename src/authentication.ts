import passport from 'passport'
import { Strategy as OAuth2Strategy } from 'passport-oauth2'
import fetch from 'node-fetch'
import { env } from './env'
import { Request, Response, NextFunction } from 'express'
import { log } from './logger'
import { DatabaseService } from './services'
import { transformApiUserToDb, transformApiCampusToDb } from './transform'

/**
 * Middleware to ensure user is authenticated.
 * @param req Request object containing user information
 * @param res Response object to redirect if not authenticated
 * @param next Function to call after authentication check
 * @returns Redirects to OAuth login if user is not authenticated
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
	if (!req.user) {
		res.redirect(`${env.authPath}`)
	} else {
		next()
	}
}

// Store (only) access token in session
passport.serializeUser((user: any, done) => {
	done(null, { accessToken: user.accessToken, login: user.login })
})

// On every request, validate access token
passport.deserializeUser(async (sessionUser: { accessToken: string, login: string }, done) => {
	try {
		const user = await DatabaseService.findUserByLogin(sessionUser.login);

		if (!user) {
			log(2, 'Access token is no longer valid');
			done(null, false);
		}

		done(null, { accessToken: sessionUser.accessToken, isAuthenticated: true });

	} catch (error) {
		log(2, 'Cannot verify token');
		done(null, false);
	}
})

// OAuth2 strategy for initial authentication
const opt = {
	authorizationURL: env.authorizationURL,
	tokenURL: env.tokenURL,
	clientID: env.tokens.userAuth.UID,
	clientSecret: env.tokens.userAuth.secret,
	callbackURL: env.tokens.userAuth.callbackURL,
}

const client = new OAuth2Strategy(opt, async (accessToken: string, refreshToken: string, _profile: string, done: (err: string | null, user: any) => void) => {
	try {
		const userDB = await fetchandInsertUserData(accessToken);
		done(null, { accessToken, refreshToken, login: userDB.login });
	} catch (error) {
		done('Authentication failed', null);
	}
})

async function fetchandInsertUserData(accessToken: string) {
	const response = await fetch('https://api.intra.42.fr/v2/me', {
		headers: { Authorization: `Bearer ${accessToken}` },
	})
	const json = await response.json();
	const userDB = transformApiUserToDb(json);
	if (await DatabaseService.findUserByLogin(userDB.login) === null) {
		const missingCampusId = await DatabaseService.getMissingCampusId(json);
		if (missingCampusId !== null) {
			log(2, `Found missing campus ID ${missingCampusId}, syncing...`);
			try {
				const campusResponse = await fetch(`https://api.intra.42.fr/v2/campus/${missingCampusId}`, {
					headers: { Authorization: `Bearer ${accessToken}` },
				});
				const campusJson = await campusResponse.json();
				await DatabaseService.insertCampus({ ...transformApiCampusToDb(campusJson) });
				userDB.primary_campus_id = missingCampusId;
				log(1, `Successfully synced and assigned campus ID ${missingCampusId} to user ${userDB.login}`);

			} catch (error) {
				console.error(`Assigning to non-existent campus; failed to fetch ${missingCampusId}:`, error);
				DatabaseService.insertCampus({ id: 42, name: `Ghost Campus` });
				userDB.primary_campus_id = 42; // Assign to Ghost Campus
			}
		}
		await DatabaseService.insertUser(userDB);
	}
	return userDB;
}

passport.use(env.provider, client)

export { passport }
