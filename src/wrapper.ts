import Fast42 from "@codam/fast42";
import { NODE_ENV, DEV_DAYS_LIMIT } from "./env";

/**
 * Fetch all items from all pages of a Fast42 API endpoint.
 * @usage const codamStudents = await fetchMultiple42ApiPages(api, '/v2/campus/14/users');
 * @param api A Fast42 instance
 * @param path The API path to fetch
 * @param params Optional query parameters for the API request
 * @returns A promise that resolves to an array containing all items from all pages of the API responses
 */
export const fetchMultiple42ApiPages = async function(api: Fast42, path: string, params: { [key: string]: string } = {}): Promise<any[]> {
	return new Promise(async (resolve, reject) => {
		try {
			const pages = await api.getAllPages(path, params);

			let i = 0;
			const pageItems = await Promise.all(pages.map(async (page) => {
				let p = null;
				pageFetch: while (!p) {
					p = await page;
					if (p.status == 429) {
						console.error('Intra API rate limit exceeded, let\'s wait a bit...');
						const waitFor = parseInt(p.headers.get('Retry-After') ?? '1');
						console.log(`Waiting ${waitFor} seconds...`);
						await new Promise((resolve) => setTimeout(resolve, waitFor * 1000 + Math.random() * 1000));
						p = null;
						continue pageFetch;
					}
					if (!p.ok) {
						throw new Error(`Intra API error: ${p.status} ${p.statusText} on ${p.url}`);
					}
				}
				if (p.ok) {
					const data = await p.json();
					console.debug(`Fetched page ${++i} of ${pages.length} on ${path}...`);
					return data;
				}
			}));
			return resolve(pageItems.flat());
		}
		catch (err) {
			return reject(err);
		}
	});
};

/**
 * Fetch all items from all pages of a Fast42 API endpoint, with a callback function for each page fetched.
 * Useful for larger datasets that may not fit in memory.
 * @usage const codamStudents = await fetchMultiple42ApiPages(api, '/v2/campus/14/users');
 * @param api A Fast42 instance
 * @param path The API path to fetch
 * @param params Optional query parameters for the API request
 * @param callback A callback function to call for each page fetched
 * @returns A promise that resolves to an array containing all items from all pages of the API responses
 */
export const fetchMultiple42ApiPagesCallback = async function(api: Fast42, path: string, params: { [key: string]: string } = {}, callback: (data: any, xPage: number, xTotal: number) => void): Promise<void> {
	return new Promise(async (resolve, reject) => {
		try {
			const pages = await api.getAllPages(path, params);

			let i = 0;
			for (const page of pages) {
				let p = null;
				pageFetch: while (!p) {
					p = await page;
					if (!p) {
						console.log('Retrying page fetch...');
						await new Promise((resolve) => setTimeout(resolve, 1000));
						continue pageFetch;
					}
					if (p.status == 429) {
						console.error('Intra API rate limit exceeded, let\'s wait a bit...');
						const waitFor = parseInt(p.headers.get('Retry-After') ?? '1');
						console.log(`Waiting ${waitFor} seconds...`);
						await new Promise((resolve) => setTimeout(resolve, waitFor * 1000 + Math.random() * 1000));
						p = null;
						continue pageFetch;
					}
					if (!p.ok) {
						throw new Error(`Intra API error: ${p.status} ${p.statusText} on ${p.url}`);
					}
				}
				if (p.ok) {
					const xPage = parseInt(p.headers.get('X-Page') ?? '1');
					const xTotal = parseInt(p.headers.get('X-Total') ?? '1');
					const data = await p.json();
					console.debug(`Fetched page ${++i} of ${pages.length} on ${path}...`);
					callback(data, xPage, xTotal);
				}
			}
			return resolve();
		}
		catch (err) {
			return reject(err);
		}
	});
};

/**
 * Fetch a single page of a Fast42 API endpoint.
 * @param api A Fast42 instance
 * @param path The API path to fetch
 * @param params Optional query parameters for the API request
 * @returns A promise that resolves to the JSON data from the API response
 */
export const fetchSingle42ApiPage = async function(api: Fast42, path: string, params: { [key: string]: string } = {}): Promise<any> {
	return new Promise(async (resolve, reject) => {
		try {
			retry: while (true) {
				const page = await api.get(path, params);

				if (page.status == 429) {
					console.error('Intra API rate limit exceeded, let\'s wait a bit...');
					const waitFor = parseInt(page.headers.get('Retry-After') ?? '1');
					console.log(`Waiting ${waitFor} seconds...`);
					await new Promise((resolve) => setTimeout(resolve, waitFor * 1000 + Math.random() * 1000));
					continue retry;
				}
				if (page.ok) {
					const data = await page.json();
					return resolve(data);
				}
				else {
					reject(`Intra API error: ${page.status} ${page.statusText} on ${page.url}`);
					break;
				}
			}
		}
		catch (err) {
			return reject(err);
		}
	});
};

/**
 * Synchronize data with the Intra API.
 * @param api A Fast42 instance
 * @param syncDate The current date
 * @param lastSyncDate The date of the last synchronization
 * @param path The API path to fetch
 * @param params The query parameters for the API request
 */
export const syncData = async function(api: Fast42, syncDate: Date, lastSyncDate: Date | undefined, path: string, params: any): Promise<any[]> {
	// In development mode we do not want to be stuck fetching too much data,
	// so we impose a limit based on the DEV_DAYS_LIMIT environment variable.
	//
	// The only case in which we do not want to do this is the users endpoint,
	// for which we always fetch all data
	if (lastSyncDate === undefined && NODE_ENV == "development" && !path.includes('/users')) {
		lastSyncDate = new Date(syncDate.getTime() - DEV_DAYS_LIMIT * 24 * 60 * 60 * 1000);
	}

	if (lastSyncDate !== undefined) {
		params['range[updated_at]'] = `${lastSyncDate.toISOString()},${syncDate.toISOString()}`;
		console.log(`Fetching data from Intra API updated on path ${path} since ${lastSyncDate.toISOString()}...`);
	}
	else {
		console.log(`Fetching all data from Intra API on path ${path}...`);
	}

	return await fetchMultiple42ApiPages(api, path, params);
};

/**
 * Synchronize data with the Intra API.
 * @param api A Fast42 instance
 * @param syncDate The current date
 * @param lastSyncDate The date of the last synchronization
 * @param path The API path to fetch
 * @param params The query parameters for the API request
 * @param callback A callback function to handle the synchronized data
 */
export const syncDataCB = async function(api: Fast42, syncDate: Date, lastSyncDate: Date | undefined, path: string, params: any, callback: (data: any) => void): Promise<void> {
	// In development mode we do not want to be stuck fetching too much data,
	// so we impose a limit based on the DEV_DAYS_LIMIT environment variable.
	if (lastSyncDate === undefined && NODE_ENV == "development") {
		lastSyncDate = new Date(syncDate.getTime() - DEV_DAYS_LIMIT * 24 * 60 * 60 * 1000);
	}

	if (lastSyncDate !== undefined) {
		if (!path.includes('locations')) {
			params['range[updated_at]'] = `${lastSyncDate.toISOString()},${syncDate.toISOString()}`;
		}
		else {
			// Decrease lastSyncDate by 72 hours
			// Locations do not have the updated_at field, so we use the begin_at field instead
			lastSyncDate = new Date(lastSyncDate.getTime() - 72 * 60 * 60 * 1000);
			params['range[begin_at]'] = `${lastSyncDate.toISOString()},${syncDate.toISOString()}`;
		}
		console.log(`Fetching data from Intra API updated on path ${path} since ${lastSyncDate.toISOString()}...`);
	}
	else {
		console.log(`Fetching all data from Intra API on path ${path}...`);
	}

	await fetchMultiple42ApiPagesCallback(api, path, params, callback);
}
