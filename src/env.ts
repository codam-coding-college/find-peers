import fs from 'fs'

const tokens = JSON.parse(fs.readFileSync('./env/tokens.json').toString())
if (!tokens.clientUID.length || !tokens.clientSecret.length) {
	console.error('Token file invalid')
	process.exit(1)
}

const projectIDs: { [key: string]: number }[] = JSON.parse(fs.readFileSync('./env/projectIDs.json').toString())
console.log(`Watching ${Object.keys(projectIDs).length} projects`)

export interface Env {
	pullTimeout: number
	projectIDs: { [key: string]: number }[]
	codamCampusID: number
	_42CursusID: number
	scope: string[]
	authorizationURL: string
	callbackURL: string
	tokenURL: string
	provider: string
	authPath: string,
	clientUID: string
	clientSecret: string
}

export const env: Env = {
	pullTimeout: 24 * 60 * 60 * 1000, // how often to pull the project users statuses form the intra api (in Ms)
	projectIDs,
	_42CursusID: 21,
	codamCampusID: 14,
	authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
	callbackURL: 'https://find-peers.joppekoers.nl/auth/42/callback',
	tokenURL: 'https://api.intra.42.fr/oauth/token',
	provider: '42',
	authPath: '/auth/42', // TODO
	scope: ['public'],
	...tokens,
}
