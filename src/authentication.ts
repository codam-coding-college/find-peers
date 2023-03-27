import passport from 'passport'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { OAuth2Strategy } = require('passport-oauth')
import fetch from 'node-fetch'
import fs from 'fs'
import { env } from './env'
import { UserProfile } from './types'
import { Request, Response, NextFunction } from 'express'

export function authenticate(req: Request, res: Response, next: NextFunction) {
	if (!req.user) {
		res.redirect(`/auth/${env.provider}`)
	} else {
		next()
	}
}

const usersDB: UserProfile[] = []
const emptyUsersDB: string = JSON.stringify(usersDB)
if (!fs.existsSync(env.userDBpath) || fs.statSync(env.userDBpath).size < emptyUsersDB.length) fs.writeFileSync(env.userDBpath, emptyUsersDB)

const users: UserProfile[] = JSON.parse(fs.readFileSync(env.userDBpath).toString())

passport.serializeUser((user, done) => {
	//@ts-ignore
	done(null, user.id)
})

passport.deserializeUser((id, done) => {
	const user = users.find(user => user.id === id)
	done(null, user)
})

async function getProfile(accessToken: string, refreshToken: string): Promise<UserProfile | null> {
	try {
		const response = await fetch('https://api.intra.42.fr/v2/me', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})
		const json = await response.json()
		const profile: UserProfile = {
			id: json.id,
			login: json.login,
			first_name: json.first_name,
			displayname: json.displayname,
			campusID: json.campus.length > 0 ? json.campus[0].id : 42, // set user's campus to first one listed in API call
			campusName: json.campus.length > 0 ? json.campus[0].name : 'Paris',
			timeZone: json.campus.length > 0 ? json.campus[0].time_zone : 'Europe/Paris',
			accessToken,
			refreshToken,
		}
		for (const i in json.campus_users) {
			// get user's primary campus
			if (json.campus_users[i].is_primary) {
				for (const j in json.campus) {
					// get primary campus name and store it in UserProfile (overwriting the one assigned above, which might not be primary)
					if (json.campus[j].id === json.campus_users[i].campus_id) {
						profile.campusName = json.campus[j].name
						profile.timeZone = json.campus[j].time_zone
						profile.campusID = json.campus_users[i].campus_id
						break
					}
				}
				break
			}
		}
		return profile
	} catch (err) {
		return null
	}
}
const opt = {
	authorizationURL: env.authorizationURL,
	tokenURL: env.tokenURL,
	clientID: env.tokens.userAuth.UID,
	clientSecret: env.tokens.userAuth.secret,
	callbackURL: env.tokens.userAuth.callbackURL,
	// passReqToCallback: true
}
const client = new OAuth2Strategy(opt, async (accessToken: string, refreshToken: string, _profile: string, done: (err: string | null, user: UserProfile | null) => void) => {
	// fires when user clicked allow
	const newUser = await getProfile(accessToken, refreshToken)
	if (!newUser) {
		return done('cannot get user info', null)
	}
	const userIndex = users.findIndex(user => user.id === newUser.id)
	if (userIndex < 0) {
		users.push(newUser)
	} else {
		users[userIndex] = newUser
	}
	await fs.promises.writeFile(env.userDBpath, JSON.stringify(users))
	done(null, newUser)
})
passport.use(env.provider, client)

export { passport }
