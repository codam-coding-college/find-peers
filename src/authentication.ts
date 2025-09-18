import passport from 'passport'
import { Strategy as OAuth2Strategy } from 'passport-oauth2'
import fetch from 'node-fetch'
import { env } from './env'
import { Request, Response, NextFunction } from 'express'
import { log } from './logger'

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
	done(null, user.accessToken)
})

// On every request, validate access token
passport.deserializeUser(async (accessToken: string, done) => {
    try {
        const response = await fetch('https://api.intra.42.fr/v2/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (response.ok) {
            done(null, { accessToken, isAuthenticated: true });
        } else {
            log(2, 'Access token is no longer valid');
            done(null, false);
        }
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
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        if (response.ok) {
            // Don't fetch user data - just pass the token
            done(null, { accessToken, refreshToken });
        } else {
            done('Invalid access token', null);
        }
    } catch (error) {
        done('Authentication failed', null);
    }
})

passport.use(env.provider, client)

export { passport }
