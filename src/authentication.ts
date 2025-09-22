import passport from 'passport'
import { Strategy as OAuth2Strategy } from 'passport-oauth2'
import fetch from 'node-fetch'
import { env } from './env'
import { Request, Response, NextFunction } from 'express'
import { log } from './logger'
import { DatabaseService } from './services'
import { transformApiUserToDb } from './transform'
import { prisma } from './prismaClient'

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
        const user = await prisma.user.findFirst({
            where: { login: sessionUser.login }
        })

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

// Minimal strategy - only validate the access token
const client = new OAuth2Strategy(opt, async (accessToken: string, refreshToken: string, _profile: string, done: (err: string | null, user: any) => void) => {
    try {
        const response = await fetch('https://api.intra.42.fr/v2/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = await response.json();
        const userDB = transformApiUserToDb(json);
        if (await prisma.findFirst({ where: { login: userDB.login } }) === null) {
            await DatabaseService.insertUser(userDB);
        }
        done(null, { accessToken, refreshToken, login: userDB.login });
    } catch (error) {
        done('Authentication failed', null);
    }
})

passport.use(env.provider, client)

export { passport }
