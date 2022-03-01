import fetch from 'node-fetch'
import parameterAppend from 'url-parameter-append'

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

export class API {
	private _root: string
	private _tokens: Tokens
	private _accessToken: AccessToken | null
	private _logging: boolean
	private _accessTokenExpiry: number

	constructor(clientUID: string, clientSecret: string, logging: boolean = false, root = 'https://api.intra.42.fr') {
		this._logging = logging
		this._root = root
		this._tokens = { clientUID, clientSecret }
		this._accessToken = null
		this._accessTokenExpiry = -1
	}

	private async _updateToken() {
		if (this._accessTokenExpiry > Date.now() + 60 * 1000)
			return

		const response = await fetch(`${this._root}/oauth/token`, {
			method: 'POST',
			body: `grant_type=client_credentials&client_id=${this._tokens.clientUID}&client_secret=${this._tokens.clientSecret}`,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
		})
		this._accessToken = await response.json()
		this._accessTokenExpiry = this._accessToken!.created_at * 1000 + this._accessToken!.expires_in * 1000
	}

	async get(path: string, parameters?: { [key: string]: string | number }[]): Promise<any> {
		await this._updateToken()
		let requestPath = `${this._root}${path}`
		if (parameters)
			for (const key of parameters)
				requestPath = parameterAppend(requestPath, key)

		if (this._logging)
			console.error('REQUEST', requestPath, parameters)
		const response = await fetch(requestPath, {
			headers: {
				Authorization: `Bearer ${this._accessToken!.access_token}`,
			}
		})
		return await response.json()
	}

	async getPaged(path: string, parameters?: { [key: string]: string | number }[], onPage?: (response: any) => void): Promise<any[]> {
		let items: any[] = []

		if (!parameters)
			parameters = []
		parameters.push({ 'page[number]': '<placeholder>' })
		for (let i = 1; ; i++) {
			for (let p of parameters)
				if (p['page[number]'])
					p['page[number]'] = i

			const block = await this.get(path, parameters) // TODO: fix & and ?
			if (block.length == 0)
				break
			if (onPage)
				onPage(block)
			items = items.concat(block)
		}
		return items
	}
}
