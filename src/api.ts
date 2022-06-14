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

class RequestLimiter {
	private _maxRequestPerSecond: number
	private _thisSecond: number
	private _requestsThisSecond: number

	constructor(maxRequestPerSecond: number) {
		this._maxRequestPerSecond = maxRequestPerSecond
		this._thisSecond = 0
		this._requestsThisSecond = 0
	}

	async limit(): Promise<void> {
		const now = Date.now()
		if (Math.floor(now / 1000) != this._thisSecond) {
			this._requestsThisSecond = 0
			this._thisSecond = Math.floor(now / 1000)
			return
		}
		this._requestsThisSecond++
		if (this._requestsThisSecond >= this._maxRequestPerSecond) {
			await new Promise(resolve => setTimeout(resolve, ((this._thisSecond + 1) * 1000) - now))
		}
	}
}

export class API {
	private _root: string
	private _tokens: Tokens
	private _accessToken: AccessToken | null
	private _logging: boolean
	private _accessTokenExpiry: number
	private _startCooldown: number
	private _cooldown: number
	private _cooldownGrowthFactor: number
	private _limiter: RequestLimiter

	constructor(clientUID: string, clientSecret: string, maxRequestPerSecond: number = 1 / 3, logging: boolean = false, root = 'https://api.intra.42.fr') {
		this._logging = logging
		this._root = root
		this._tokens = { clientUID, clientSecret }
		this._accessToken = null
		this._accessTokenExpiry = -1
		this._startCooldown = 1500
		this._cooldown = this._startCooldown
		this._cooldownGrowthFactor = 2
		this._limiter = new RequestLimiter(maxRequestPerSecond)
	}

	private async _fetch(path: string, opt: Object, isTokenUpdateRequest: boolean): Promise<Object> {
		if (!isTokenUpdateRequest)
			await this._updateToken()
		if (this._logging)
			console.log(`${new Date().toISOString()} REQUEST ${path}`)
		let response
		try {
			await this._limiter.limit()
			response = await fetch(path, opt)
			const json = await response.json()
			this._cooldown = this._startCooldown
			return json
		} catch (err) {
			if (this._logging || response?.status != 429)
				console.log(`${new Date().toISOString()} [fetch error]: status: ${response?.status} body: ${JSON.stringify(response)} retrying in ${this._cooldown / 1000} seconds`)
			await new Promise(resolve => setTimeout(resolve, this._cooldown))
			this._cooldown *= this._cooldownGrowthFactor
			return await this._fetch(path, opt, isTokenUpdateRequest)
		}
	}

	private async _updateToken() {
		if (this._accessTokenExpiry > Date.now() + 60 * 1000)
			return
		const opt = {
			method: 'POST',
			body: `grant_type=client_credentials&client_id=${this._tokens.clientUID}&client_secret=${this._tokens.clientSecret}`,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
		}
		this._accessToken = await this._fetch(`${this._root}/oauth/token`, opt, true) as AccessToken
		this._accessTokenExpiry = + Date.now() + this._accessToken!.expires_in * 1000
		if (this._logging)
			console.log(`[new token]: expires in ${this._accessToken!.expires_in} seconds, on ${new Date(this._accessTokenExpiry).toISOString()}`)
	}

	async get(path: string, parameters?: { [key: string]: string | number }[]): Promise<any> {
		await this._updateToken()
		let requestPath = `${this._root}${path}`
		if (parameters)
			for (const key of parameters)
				requestPath = parameterAppend(requestPath, key)
		const opt = {
			headers: {
				Authorization: `Bearer ${this._accessToken!.access_token}`,
			}
		}
		return await this._fetch(requestPath, opt, false)
	}

	async getPaged(path: string, parameters?: { [key: string]: string | number }[], onPage?: (response: any) => void): Promise<any[]> {
		let items: any[] = []

		if (!parameters)
			parameters = []
		if (!parameters['page[number]'] && !parameters['page_size'])
			parameters.push({ 'page[size]': 100 })
		parameters.push({ 'page[number]': '<placeholder>' })
		for (let i = 1; ; i++) {
			for (let p of parameters)
				if (p['page[number]'])
					p['page[number]'] = i

			const block = await this.get(path, parameters)
			if (block.length == 0)
				break
			if (onPage)
				onPage(block)
			items = items.concat(block)
		}
		return items
	}
}
