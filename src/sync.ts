import Fast42 from "@codam/fast42";
import { env } from "./env";
import { syncData, fetchSingle42ApiPage } from "./wrapper";
import { transformApiCampusToDb, transformApiProjectUserToDb, transformApiUserToDb, transformApiProjectToDb } from './transform';
import { DatabaseService } from './services';
import { log } from "./logger";

const fast42Api = new Fast42(
	[
		{
			client_id: env.tokens.sync.UID,
			client_secret: env.tokens.sync.secret,
		},
	]
);

/**
 * Initialize Fast42 API.
 */
let fast42Initialized = false;
async function initializeFast42() {
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
	if (!fast42Initialized) {
		console.log('Waiting for Fast42 to initialize...');
		await initializeFast42();
	}
	const now = new Date();

	try {
		let lastSyncRaw = await DatabaseService.getLastSyncTimestamp();
		let lastSync: Date | undefined = lastSyncRaw === null ? undefined : lastSyncRaw;

		await syncProjectUsers(fast42Api, lastSync);
		await DatabaseService.saveSyncTimestamp(now);

		console.info(`Intra synchronization completed at ${new Date().toISOString()}.`);
	}
	catch (err) {
		console.error('Failed to synchronize with Intra:', err);
		console.log('Future synchronization attempts will start from the last successful sync timestamp, so no data should be missing.');
	}
}

/**
 * Sync project users with the Fast42 API using a callback.\
 * -If a new project is found, create project using projectUser data.\
 * -If a new user is found, create user using users/${user_id}.\
 * -If a new campus is found, sync campus data using the user's campus_id.
 * @param fast42Api The Fast42 API instance to use for fetching project users
 * @param lastPullDate The date of the last synchronization
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncProjectUsers(fast42Api: Fast42, lastPullDate: Date | undefined): Promise<void> {
    let pageIndex = 0;
    let hasMorePages = true;
    let params: { [key: string]: string } = { 'page[size]': '100' };

    if (lastPullDate) {
        let syncDate = new Date();
        params['range[updated_at]'] = `${lastPullDate.toISOString()},${syncDate.toISOString()}`;
    }
    while (hasMorePages) {
        try {
            pageIndex++;
            params['page[number]'] = pageIndex.toString();
            log(2, `Fetching page ${pageIndex} of project users...`);

            const totalProjectUsersData = await fetchSingle42ApiPage(fast42Api, '/projects_users', params);
            if (!totalProjectUsersData || totalProjectUsersData.length === 0) {
                log(2, `No more project users found on page ${pageIndex}. Stopping.`);
                hasMorePages = false;
                break;
            }

            const projectUsersData = await DatabaseService.filterNewProjectUsers(totalProjectUsersData);
            if (projectUsersData.length === 0) {
                log(2, `Page ${pageIndex} contains no new project users. Skipping.`);
                continue;
            }

            log(2, `Processing page ${pageIndex} with ${projectUsersData.length} project users...`);

            await syncMissingProjects(projectUsersData);
            await syncMissingUsers(projectUsersData, lastPullDate);

            log(2, `Inserting ${projectUsersData.length} project users from page ${pageIndex}...`);
            const dbProjectUsers = projectUsersData.map(transformApiProjectUserToDb);
            await DatabaseService.insertManyProjectUsers(dbProjectUsers);

            log(2, `✓ Successfully processed page ${pageIndex}`);
        } catch (error) {
            console.error(`Failed to process page ${pageIndex}:`, error);
            throw error;
        }
    }
    log(2, `Finished syncing project users. Processed ${pageIndex} pages total.`);
}

/**
 * Sync missing projects with the Fast42 API.
 * @param projectUsersData The project users data to sync
 */
async function syncMissingProjects(projectUsersData: any[]): Promise<void> {
    let missingProjects = await DatabaseService.getMissingProjects(projectUsersData);
    for (let retries = 3; missingProjects.length > 0 && retries > 0; retries--) {
        log(2, `Found ${missingProjects.length} missing projects, syncing...`);
        await syncProjects(missingProjects);
        missingProjects = await DatabaseService.getMissingProjects(projectUsersData);
        if (missingProjects.length > 0) {
            console.error(`WARNING: Still missing ${missingProjects.length} projects after sync`);
        }
    }
}

/**
 * Sync projects with the Fast42 API.
 * @param projects The list of projects to sync
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncProjects(projects: any[]): Promise<void> {
    try {
        log(2, `Processing ${projects.length} projects...`);
        for (const project of projects) {
            try {
                const apiProjectData = await syncData(fast42Api, new Date(), undefined, `/projects/${project.id}`, {});
                if (apiProjectData && apiProjectData.length > 0) {
                    const dbProject = transformApiProjectToDb(apiProjectData[0]);
                    await DatabaseService.insertProject(dbProject);
                } else {
                    log(2, `No data found for project ID: ${project.id}`);
                    await DatabaseService.insertProject(
                        { name: project.name, id: project.id, slug: project.slug, campus_ids: '' });
                }
            } catch (error) {
                console.error(`Failed to fetch project ${project.id}:`, error);
                await DatabaseService.insertProject(
                    { name: project.name, id: project.id, slug: project.slug, campus_ids: '' });
            }
        }
        log(2, 'Finished syncing projects.');
    } catch (error) {
        console.error('Failed to sync projects:', error);
        throw error;
    }
}

/**
 * Sync missing users with the Fast42 API.
 * @param projectUsersData The project users data to sync
 * @param lastPullDate The date of the last synchronization
 */
async function syncMissingUsers(projectUsersData: any[], lastPullDate: Date | undefined): Promise<void> {
    let missingUserIds = await DatabaseService.getMissingUserIds(projectUsersData);
    for (let retries = 3; missingUserIds.length > 0 && retries > 0; retries--) {
        log(2, `Found ${missingUserIds.length} missing users, syncing...`);
        await syncUsers(fast42Api, lastPullDate, missingUserIds);
        missingUserIds = await DatabaseService.getMissingUserIds(projectUsersData);
        if (missingUserIds.length > 0) {
            console.error(`WARNING: Still missing ${missingUserIds.length} users after sync`);
        }
    }
}

/**
 * Sync users with the Fast42 API.
 * @param fast42Api The Fast42 API instance to use for fetching project users
 * @param lastPullDate The date of the last synchronization
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncUsers(fast42Api: Fast42, lastPullDate: Date | undefined, userIds: number[]): Promise<void> {
    for (const userId of userIds) {
        try {
            log(2, `Processing missing user ${userId}...`);
            const userApi = await syncData(fast42Api, new Date(), lastPullDate, `/users/${userId}`, {});
			const user = userApi[0];

            if (!user) {
                log(2, `No user data found for ID: ${userId}`);
                continue; // Skip to next user
            }

            const dbUser = transformApiUserToDb(user);

            const missingCampusId = await DatabaseService.getMissingCampusId(user);
            if (missingCampusId !== null) {
                log(2, `Found missing campus ID ${missingCampusId}, syncing...`);

                try {
                    await syncCampus(fast42Api, lastPullDate, missingCampusId);
                } catch (error) {
                    console.error(`Assigning to non-existent campus; failed to fetch ${missingCampusId}:`, error);
                    DatabaseService.insertCampus({ id: 1, name: `Ghost Campus` });
                    dbUser.primary_campus_id = 1; // Assign to Ghost Campus
                }
            }
            await DatabaseService.insertUser(dbUser);

        } catch (error) {
            console.error(`Failed to process user ${userId}:`, error);
        }
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
