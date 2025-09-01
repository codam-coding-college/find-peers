import Fast42 from "@codam/fast42";
import { env } from "./env";
import { syncData, syncDataCB } from "./wrapper";
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

	console.info(`Starting Intra synchronization at ${now.toISOString()}...`);
	try {
		let lastSyncRaw = await DatabaseService.getLastSyncTimestamp();
		let lastSync: Date | undefined = lastSyncRaw === null ? undefined : lastSyncRaw;

		await syncProjectUsersCB(fast42Api, lastSync);
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
async function syncProjectUsersCB(fast42Api: Fast42, lastPullDate: Date | undefined): Promise<void> {
    return new Promise((resolve, reject) => {
        const callback = async (projectUsers: any[]) => {
            try {
                if (projectUsers.length === 0) {
                    console.log('No project users found to sync.');
                    return;
                }
                console.log(`Processing batch of ${projectUsers.length} project users...`);

				// If any project doesn't exist in the 'project' table, create an entry in 'project' table.
				const missingProjects = await DatabaseService.getMissingProjects(projectUsers);
				missingProjects.forEach(project => {
					log(2, `Missing Project - ID: ${project.id}, Name: ${project.name}`);
				});
				if (missingProjects.length > 0) {
					console.log(`Found ${missingProjects.length} missing projects, syncing...`);
					await syncProjects(missingProjects);
				}

				// If any projectUser doesn't exist in the 'user' table, create an entry in 'user' table.
				const missingUserIds = await DatabaseService.getMissingUserIds(projectUsers);
				if (missingUserIds.length > 0) {
					console.log(`Found ${missingUserIds.length} missing users, syncing...`);
					await syncUsersCB(fast42Api, lastPullDate, missingUserIds);
				}

				if (projectUsers.length > 1) {
					const dbProjectUsers = projectUsers.map(transformApiProjectUserToDb);
					await DatabaseService.insertManyProjectUsers(dbProjectUsers);
				} else if (projectUsers.length === 1) {
					const dbProjectUser = transformApiProjectUserToDb(projectUsers[0]);
					await DatabaseService.insertProjectUser(dbProjectUser);
				}
			} catch (error) {
				console.error('Failed to process project users batch:', error);
				throw error;
            }
        };

        syncDataCB(fast42Api, new Date(), lastPullDate, '/projects_users',
			{ 'page[size]': '100', 'filter[campus]': '14' }, callback)
            .then(() => {
                console.log('Finished syncing project users with callback method.');
                resolve();
            })
            .catch((error) => {
                console.error('Failed to sync project users with callback:', error);
                reject(error);
            });
    });
}

/**
 * Sync users with the Fast42 API using a callback.
 * @param fast42Api The Fast42 API instance to use for fetching project users
 * @param lastPullDate The date of the last synchronization
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncUsersCB(fast42Api: Fast42, lastPullDate: Date | undefined, userIds: number[]): Promise<void> {
	const promises = userIds.map(userId => {
		return new Promise((resolve, reject) => {
			const callback = async (users: any[]) => {
				try {
					if (users.length == 0) {
						console.log('No users found to sync.');
						return;
					}
					console.log(`Processing batch of ${users.length} users...`);

					// If any projectUser doesn't exist in the 'user' table, create an entry in 'user' table.
					const missingCampusIds = await DatabaseService.getMissingCampusIds(users);
					if (missingCampusIds.length > 0) {
						console.log(`Found ${missingCampusIds.length} missing campuses, syncing...`);
						await syncCampus(fast42Api, lastPullDate, missingCampusIds);
					}

					if (users.length > 1) {
						const dbUsers = users.map(transformApiUserToDb);
						await DatabaseService.insertManyUsers(dbUsers);
					} else if (users.length === 1) {
						const dbUser = transformApiUserToDb(users[0]);
						await DatabaseService.insertUser(dbUser);
					}
				} catch (error) {
					console.error('Failed to process project users batch:', error);
					throw error;
				}
			};

			// Fetch user for each userId
			syncDataCB(fast42Api, new Date(), lastPullDate, `/users/${userId}`,
				{ 'page[size]': '100' }, callback)
				.then(() => {
					console.log('Finished syncing users with callback method.');
					resolve(undefined);
				})
				.catch((error) => {
					console.error('Failed to sync users with callback:', error);
					reject(error);
				});
		});
	});
	await Promise.all(promises);
	console.log('Syncing Users completed.');
}

/**
 * Sync campuses with the Fast42 API.
 * @param fast42Api The Fast42 API instance to use for fetching campuses
 * @param lastPullDate The date of the last synchronization
 * @param campusIds The IDs of the campuses to sync
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncCampus(fast42Api: Fast42, lastPullDate: Date | undefined, campusIds: number[]): Promise<void> {
	// Fetch all campuses in one API call using filter[id]
	try {
		const campuses = await syncData(fast42Api, new Date(), lastPullDate, '/campus',
			{ 'page[size]': '100', 'filter[id]': campusIds.join(',') }
		);

		if (!Array.isArray(campuses) || campuses.length === 0) {
			console.log(`No campuses found with ids: ${campusIds.join(", ")}.`);
			return;
		}

		console.log(`Processing ${campuses.length} campuses...`);
		if (campuses.length > 1) {
			const dbCampuses = campuses.map(transformApiCampusToDb);
			await DatabaseService.insertManyCampuses(dbCampuses);
		} else if (campuses.length === 1) {
			const dbCampus = transformApiCampusToDb(campuses[0]);
			await DatabaseService.insertCampus(dbCampus);
		}
		console.log('Finished syncing campuses.');
	} catch (error) {
		console.error('Failed to sync campuses:', error);
		throw error;
	}
}

/**
 * Sync projects with the Fast42 API.
 * @param projects The list of projects to sync
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncProjects(projects: any[]): Promise<void> {
	try {
		console.log(`Processing ${projects.length} projects...`);
		const dbProjects = projects.map(transformApiProjectToDb);
		await DatabaseService.insertManyProjects(dbProjects);
		console.log('Finished syncing projects.');
	} catch (error) {
		console.error('Failed to sync projects:', error);
		throw error;
	}
}
