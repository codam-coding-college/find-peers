import fetch from 'node-fetch'
import fs from 'fs'

interface Tokens {
	clientUID: string
	clientSecret: string
}

interface AccessToken {
	access_token: string
	token_type: string
	expires_in: number
	scope: string
	created_at: number
}
const root = 'https://api.intra.42.fr'
const settings = `?page[size]=10`
const codamCampusID = 14
const jkoersID = 66365
const joppeID = 105119
const netPracticeID = 2007

async function getAccessToken(): Promise<AccessToken> {
	const response = await fetch(`${root}/oauth/token`, {
		method: 'POST',
		body: `grant_type=client_credentials&client_id=${tokens.clientUID}&client_secret=${tokens.clientSecret}`,
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
	})
	return await response.json()
}

async function getEvents(accessToken: AccessToken) {
	const response = await fetch(`${root}/v2/campus/${codamCampusID}/events${settings}`, {
		headers: {
			Authorization: `Bearer ${accessToken.access_token}`,
		}
	})
	return await response.json()
}

async function getProjects(accessToken: AccessToken) {
	return await getInLoop(accessToken, '/v2/projects/')
}

async function get(accessToken: AccessToken, path: string): Promise<any> {
	console.error('REQUEST', path)
	const response = await fetch(`${root}${path}`, {
		headers: {
			Authorization: `Bearer ${accessToken.access_token}`,
		}
	})
	return await response.json()
}

async function getInLoop(accessToken: AccessToken, path: string): Promise<any[]> {
	let items: any[] = []

	for (let i = 1; ; i++) {
		const block = await get(accessToken, `${path}&page[number]=${i}`) // TODO: fix & and ?
		if (block.length == 0)
			break
		items = items.concat(block)
	}
	return items
}

async function getProjectSubscribers(accessToken: AccessToken, projectID: number): Promise<any[]> {
	return await getInLoop(accessToken, `/v2/projects/${projectID}/projects_users?filter[campus]=${codamCampusID}`)
}

const tokens: Tokens = JSON.parse(fs.readFileSync('tokens.json').toString());
(async () => {
	const accessToken: AccessToken = await getAccessToken()
	const projectIDs = JSON.parse(fs.readFileSync('./data/projectIDs.json').toString())
	for (const id in projectIDs) {
		console.log(id)
		const subs = await getProjectSubscribers(accessToken, projectIDs[id])
		for (const sub of subs) {
			if (sub.status != 'finished')
				console.log(`${sub.user.login},${sub.status},${sub.marked}`)
		}
		console.log('\n')
	}
	// console.log(subs)
})()
