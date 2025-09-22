import Fast42 from "@codam/fast42";
import { NODE_ENV, DEV_DAYS_LIMIT, env } from "./env";
import { transformApiCampusToDb, transformApiUserToDb, transformApiProjectToDb, transformApiProjectUserToDb } from './transform';
import { DatabaseService } from './services';
import { log } from "./logger";

const fast42Api = new Fast42(
	[
		{
			client_id: env.tokens.sync.UID,
			client_secret: env.tokens.sync.secret,
		},
	],
    undefined,      // concurrentOffset (keep default)
    60000           // jobExpiration: 60 seconds
);

/**
 * Initialize Fast42 API.
 */
let fast42Initialized = false;
async function initializeFast42() {
    if (fast42Initialized) {
        return;
    }
	try {
		await fast42Api.init();
		fast42Initialized = true;
		console.log('Fast42 initialized successfully');
	} catch (error) {
		console.error('Failed to initialize Fast42:', error);
	}
}

/**
 * Synchronize with 42API.
 * This function fetches project users, users, campuses, and projects from the Fast42 API and saves them to the database.
 * It also saves the last synchronization timestamp to a file.
 * @returns A promise that resolves when the synchronization is complete
 * @throws Will throw an error if the synchronization fails
 */
export const syncWithIntra = async function(): Promise<void> {
    await initializeFast42();
    if (!fast42Initialized) {
        console.log('Failed to initialize fast42...');
        return;
    }
	const now = new Date();

	try {
		let lastSyncRaw = await DatabaseService.getLastSyncTimestamp();
		let lastSync: Date | undefined = lastSyncRaw === null ? undefined : lastSyncRaw;

        await syncCursusProjects(fast42Api, lastSync, 21)      // 42 cursus
        await syncCursusProjects(fast42Api, lastSync, 9)       // Piscine cursus
		await DatabaseService.saveSyncTimestamp(now);

		console.info(`Intra synchronization completed at ${new Date().toISOString()}.`);
	}
	catch (err) {
		console.error('Failed to synchronize with Intra:', err);
		console.log('Future synchronization attempts will start from the last successful sync timestamp, so no data should be missing.');
	}
}

/**
 * Sync cursus projects with the Fast42 API.
 * @param fast42Api The Fast42 API instance to use for fetching projects
 * @param lastPullDate The date of the last synchronization
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncCursusProjects(fast42Api: Fast42, lastPullDate: Date | undefined, cursusId: number): Promise<void> {
    let pageIndex = 0;
    let hasMorePages = true;
    let params: { [key: string]: string } = { 'page[size]': '100' };

    while (hasMorePages) {
        pageIndex++;
        params['page[number]'] = pageIndex.toString();
        log(2, `Fetching page ${pageIndex} of projects...`);

		// Does /projects update when the users working on them update? (Check this later)
        const projectsData = await fetchSingle42ApiPage(fast42Api, `/cursus/${cursusId}/projects`, params);
        if (!projectsData || projectsData.length === 0) {
            log(2, `No more projects found on page ${pageIndex}. Stopping.`);
            hasMorePages = false;
            break;
        }

        log(2, `Processing page ${pageIndex} with ${projectsData.length} projects...`);
        const dbProjects = projectsData.map(transformApiProjectToDb);
        await DatabaseService.insertManyProjects(dbProjects);

        await syncProjectUsers(fast42Api, lastPullDate, projectsData);
    }
}

/**
 * Sync project users with the Fast42 API.
 * @param fast42Api The Fast42 API instance to use for fetching project users
 * @param lastPullDate The date of the last synchronization
 * @param projectsData The projects to sync with
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncProjectUsers(fast42Api: Fast42, lastPullDate: Date | undefined, projectsData: any[]): Promise<void> {
    let params: { [key: string]: string } = { 'page[size]': '100' };
    if (lastPullDate) {
        let syncDate = new Date();
        params['range[updated_at]'] = `${lastPullDate.toISOString()},${syncDate.toISOString()}`;
    }

    for (const project of projectsData) {
        let pageIndex = 0;
        let hasMorePages = true;

        while (hasMorePages) {
            pageIndex++;
            params['page[number]'] = pageIndex.toString();
            log(2, `Fetching page ${pageIndex} of projectUsers...`);

            let projectUsersData;
            try {
                projectUsersData = await fetchSingle42ApiPage(fast42Api, `/projects/${project.id}/projects_users`, params);
            } catch (error) {
                console.error(`Failed to fetch project users for project ${project.id} on page ${pageIndex}:`, error);
                break; // Skip to the next project
            }
            if (!projectUsersData || projectUsersData.length === 0) {
                log(2, `No more users found for project ${project.id} on page ${pageIndex}. Stopping.`);
                hasMorePages = false;
                break;
            }

            await syncUsers(fast42Api, lastPullDate, projectUsersData);

            log(2, `Processing page ${pageIndex} with ${projectUsersData.length} users...`);
            const dbProjectUsers = projectUsersData.map(transformApiProjectUserToDb);
            await DatabaseService.insertManyProjectUsers(dbProjectUsers);
        }
	}
}

/**
 * Sync users with the Fast42 API.
 * @param fast42Api The Fast42 API instance to use for fetching project users
 * @param lastPullDate The date of the last synchronization
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncUsers(fast42Api: Fast42, lastPullDate: Date | undefined, projectUsersData: any[]): Promise<void> {
    for (const projectUser of projectUsersData) {
        log(2, `Processing missing user ${projectUser.user.id}...`);
        const userApi = await syncData(fast42Api, new Date(), lastPullDate, `/users/${projectUser.user.id}`, {});
        const user = userApi[0];

        if (!user) {
            log(2, `No user data found for ID: ${projectUser.user.id}, skipping...`);
            continue; // Skip to next user
        }

        const dbUser = transformApiUserToDb(user);

        // What if the campus is in our database, but the campus info gets updated? (Check this later)
        const missingCampusId = await DatabaseService.getMissingCampusId(user);
        if (missingCampusId !== null) {
            log(2, `Found missing campus ID ${missingCampusId}, syncing...`);

            try {
                await syncCampus(fast42Api, lastPullDate, missingCampusId);
            } catch (error) {
                console.error(`Assigning to non-existent campus; failed to fetch ${missingCampusId}:`, error);
                DatabaseService.insertCampus({ id: 42, name: `Ghost Campus` });
                dbUser.primary_campus_id = 42; // Assign to Ghost Campus
            }
        }
        await DatabaseService.insertUser(dbUser);
    }
    log(2, 'Syncing Users completed.');
}

/**
 * Sync campuses with the Fast42 API.
 * @param fast42Api The Fast42 API instance to use for fetching campuses
 * @param lastPullDate The date of the last synchronization
 * @param campusIds The IDs of the campuses to sync
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncCampus(fast42Api: Fast42, lastPullDate: Date | undefined, campusId: number): Promise<void> {
	let campusApi;
	try {
		campusApi = await syncData(fast42Api, new Date(), lastPullDate, `/campus/${campusId}`, {});
	} catch (error) {
		console.error(`Campus ${campusId} doesn't exist`, error);
		throw error;
	}
	try {
		const campus = campusApi[0];
		log(2, `Syncing campus ${campus}...`);
		const dbCampus = transformApiCampusToDb(campus);
		await DatabaseService.insertCampus(dbCampus);
		log(2, `Finished syncing campus ${dbCampus.id} - ${dbCampus.name}`);
	} catch (error) {
		console.error(`Failed to sync campus ${campusId}:`, error);
		throw error;
	}
}

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
                while (!p) {
                    p = await page;
                    if (p.status == 429) {
                        console.error('Intra API rate limit exceeded, let\'s wait a bit...');
                        const waitFor = parseInt(p.headers.get('Retry-After') ?? '1');
                        console.log(`Waiting ${waitFor} seconds...`);
                        await new Promise((resolve) => setTimeout(resolve, waitFor * 1000 + Math.random() * 1000));
                        p = null;
                        continue;
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
