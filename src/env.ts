import fs from 'fs'

const tokens = JSON.parse(fs.readFileSync('./env/tokens.json').toString())
if (!tokens.clientUID.length || !tokens.clientSecret.length || !tokens.callbackURL.length) {
	console.error('Token file invalid, see tokens.example.json')
	process.exit(1)
}

const projectIDs: { [key: string]: number }[] = JSON.parse(fs.readFileSync('./env/projectIDs.json').toString())
console.log(`Watching ${Object.keys(projectIDs).length} projects`)

export interface Env {
	pullTimeout: number
	projectIDs: { [key: string]: number }[]
	codamCampusID: number
	_42CursusID: number
	sessionStorePath: string // session key data
	userDBpath: string	// users associated with sessions
	projectUsersPath: string // users that are subscribed to a project
	scope: string[]
	authorizationURL: string
	tokenURL: string
	provider: string
	authPath: string,
	callbackURL: string
	clientUID: string
	clientSecret: string
}

export const env: Env = {
	pullTimeout: 24 * 60 * 60 * 1000, // how often to pull the project users statuses form the intra api (in Ms)
	projectIDs,
	_42CursusID: 21,
	codamCampusID: 14,
	sessionStorePath: './database/sessions',
	userDBpath: './database/users.json',
	projectUsersPath: './database/projectUsers.json',
	authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
	tokenURL: 'https://api.intra.42.fr/oauth/token',
	provider: '42',
	authPath: '/auth/42', // TODO
	scope: ['public'],
	...tokens,
}
