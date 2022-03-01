import fs from 'fs'

const tokens = JSON.parse(fs.readFileSync('./env/tokens.json').toString())
if (!tokens.clientUID.length || !tokens.clientSecret.length) {
	console.error('Token file invalid')
	process.exit(1)
}

export interface Env {
	codamCampusID: number
	_42CursusID: number
	scope: string[]
	authorizationURL: string
	callbackURL: string
	tokenURL: string
	provider: string
	clientUID: string
	clientSecret: string
}

export const env: Env = {
	_42CursusID: 21,
	codamCampusID: 14,
	authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
	callbackURL: 'https://find-peers.joppekoers.nl/auth/42/callback',
	tokenURL: 'https://api.intra.42.fr/oauth/token',
	provider: '42',
	scope: ['public'],
	...tokens,
}
