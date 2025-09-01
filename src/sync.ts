import Fast42 from "@codam/fast42";
import { env } from "./env";
import { syncData, syncDataCB } from "./wrapper";
import { transformApiCampusToDb, transformApiProjectUserToDb, transformApiUserToDb, transformApiProjectToDb } from './transform';
import { DatabaseService } from './services';
import { log } from "./logger";
// import path from "path";
// import fs from "fs";



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

	// console.info(`Starting Intra synchronization at ${now.toISOString()}...`);
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
        const batches: any[][] = []; // Store all batches first
        
        const callback = async (projectUsers: any[]) => {
            try {
                if (projectUsers.length === 0) {
                    log(2, 'No project users found to sync.');
                    return;
                }
                // Just collect batches, don't process yet
                batches.push(projectUsers);
                log(2, `Collected batch of ${projectUsers.length} project users...`);
            } catch (error) {
                console.error('Failed to collect project users batch:', error);
                throw error;
            }
        };

        syncDataCB(fast42Api, new Date(), lastPullDate, '/projects_users',
            { 'page[size]': '100', 'filter[campus]': '14' }, callback)
            .then(async () => {
                log(2, `Collected ${batches.length} batches. Processing sequentially...`);

                // NOW process all batches sequentially using for...of
                let batchIndex = 0;
                for (const batch of batches) {
                    batchIndex++;
                    log(2, `Processing batch ${batchIndex}/${batches.length} (${batch.length} project users)...`);

                    // Process this batch sequentially
                    const missingProjects = await DatabaseService.getMissingProjects(batch);
                    if (missingProjects.length > 0) {
                        log(2, `Found ${missingProjects.length} missing projects, syncing...`);
                        await syncProjects(missingProjects);
                    }

                    const missingUserIds = await DatabaseService.getMissingUserIds(batch);
                    if (missingUserIds.length > 0) {
                        log(2, `Found ${missingUserIds.length} missing users, syncing...`);
                        await syncUsersCB(fast42Api, lastPullDate, missingUserIds);
                    }


					// Double-check missing projects and users
                    const stillMissingProjects = await DatabaseService.getMissingProjects(batch);
                    const stillMissingUsers = await DatabaseService.getMissingUserIds(batch);

                    if (stillMissingProjects.length > 0) {
                        console.error(`ERROR: Still missing ${stillMissingProjects.length} projects after sync:`, stillMissingProjects);
                        await syncProjects(stillMissingProjects);
                    }

                    if (stillMissingUsers.length > 0) {
                        console.error(`ERROR: Still missing ${stillMissingUsers.length} users after sync:`, stillMissingUsers);
                        await syncUsersCB(fast42Api, lastPullDate, stillMissingUsers);
                    }


                    log(2, `-------Inserting ${batch.length} project users...`);
                    const dbProjectUsers = batch.map(transformApiProjectUserToDb);
                    await DatabaseService.insertManyProjectUsers(dbProjectUsers);
                }

                log(2, 'Finished syncing project users with sequential batch method.');
                resolve();
            })
            .catch((error) => {
                console.error('Failed to sync project users with callback:', error);
                reject(error);
            });
    });
}
// async function syncProjectUsersCB(fast42Api: Fast42, lastPullDate: Date | undefined): Promise<void> {
//     return new Promise((resolve, reject) => {
//         const callback = async (projectUsers: any[]) => {
//             try {
//                 if (projectUsers.length === 0) {
//                     console.log('No project users found to sync.');
//                     return;
//                 }
//                 console.log(`Processing batch of ${projectUsers.length} project users...`);

// 				// If any project doesn't exist in the 'project' table, create an entry in 'project' table.
// 				const missingProjects = await DatabaseService.getMissingProjects(projectUsers);
// 				if (missingProjects.length > 0) {
// 					console.log(`Found ${missingProjects.length} missing projects, syncing...`);
// 					await syncProjects(missingProjects);
// 				}

// 				// If any projectUser doesn't exist in the 'user' table, create an entry in 'user' table.
// 				const missingUserIds = await DatabaseService.getMissingUserIds(projectUsers);
// 				if (missingUserIds.length > 0) {
// 					console.log(`Found ${missingUserIds.length} missing users, syncing...`);
// 					await syncUsersCB(fast42Api, lastPullDate, missingUserIds);
// 				}

// 				log(2, `-------Inserting ${projectUsers.length} project users...`);
// 				if (projectUsers.length > 1) {
// 					const dbProjectUsers = projectUsers.map(transformApiProjectUserToDb);
// 					await DatabaseService.insertManyProjectUsers(dbProjectUsers);
// 				} else if (projectUsers.length === 1) {
// 					const dbProjectUser = transformApiProjectUserToDb(projectUsers[0]);
// 					await DatabaseService.insertProjectUser(dbProjectUser);
// 				} else if (!Array.isArray(projectUsers)) {
// 					const dbProjectUser = transformApiProjectUserToDb(projectUsers);
// 					await DatabaseService.insertProjectUser(dbProjectUser);
// 				}
// 			} catch (error) {
// 				console.error('Failed to process project users batch:', error);
// 				throw error;
//             }
//         };

//         syncDataCB(fast42Api, new Date(), lastPullDate, '/projects_users',
// 			{ 'page[size]': '100', 'filter[campus]': '14' }, callback)
//             .then(() => {
//                 console.log('Finished syncing project users with callback method.');
//                 resolve();
//             })
//             .catch((error) => {
//                 console.error('Failed to sync project users with callback:', error);
//                 reject(error);
//             });
//     });
// }

/**
 * Sync users with the Fast42 API using a callback.
 * @param fast42Api The Fast42 API instance to use for fetching project users
 * @param lastPullDate The date of the last synchronization
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncUsersCB(fast42Api: Fast42, lastPullDate: Date | undefined, userIds: number[]): Promise<void> {
    // Process users ONE AT A TIME instead of all at once
    for (const userId of userIds) {
        try {
            log(2, `Processing missing user ${userId}...`);

            // WAIT for this API call to complete before moving to next user
            const userApi = await syncData(fast42Api, new Date(), lastPullDate, `/users/${userId}`, {});
			const user = userApi[0];

            if (!user) {
                log(2, `No user data found for ID: ${userId}`);
                continue; // Skip to next user
            }

            const dbUser = transformApiUserToDb(user);
            
            // Check for missing campus for THIS user only
            const missingCampusId = await DatabaseService.getMissingCampusId(user);
            if (missingCampusId !== null) {
                log(2, `Found missing campus ID ${missingCampusId}, syncing...`);
                // GUARANTEED: Campus insert completes BEFORE user insert
                try {
                    await syncCampus(fast42Api, lastPullDate, missingCampusId);
                } catch (error) {
                    console.error(`Assigning to non-existent campus; failed to fetch ${missingCampusId}:`, error);
                    DatabaseService.insertCampus({ id: 1, name: `Ghost Campus` });
                    dbUser.primary_campus_id = 1; // Assign to Ghost Campus
                }
            }
            // SAFE: Campus definitely exists in database by now
            await DatabaseService.insertUser(dbUser);

        } catch (error) {
            console.error(`Failed to process user ${userId}:`, error);
            // Continue with next user instead of failing completely
        }
    }
    log(2, 'Syncing Users completed.');
}
// async function syncUsersCB(fast42Api: Fast42, lastPullDate: Date | undefined, userIds: number[]): Promise<void> {
// 	const promises = userIds.map(userId => {
// 		return new Promise((resolve, reject) => {
// 			const callback = async (user: any) => {
// 				try {
// 					if (!user) {
// 						console.log('No users found to sync.');
// 						return;
// 					}
// 					console.log(`-----------Processing missing user ${user.id}...`);

// 					// If any projectUser doesn't exist in the 'user' table, create an entry in 'user' table.
// 					const missingCampusId = await DatabaseService.getMissingCampusId(user);
// 					log(2, `-----------Missing Campus ID for user ${user.id}: ${missingCampusId}`);
// 					if (missingCampusId !== null) {
// 						console.log(`------------------Found missing campus ID ${missingCampusId}, syncing...`);
// 						await syncCampus(fast42Api, lastPullDate, missingCampusId);
// 					}

// 					const dbUser = transformApiUserToDb(user);
// 					await DatabaseService.insertUser(dbUser);
// 				} catch (error) {
// 					console.error('Failed to process project users batch:', error);
// 					throw error;
// 				}
// 			};

// 			// Fetch user for each userId
// 			syncDataCB(fast42Api, new Date(), lastPullDate, `/users/${userId}`,
// 				{ 'page[size]': '100' }, callback)
// 				.then(() => {
// 					console.log('Finished syncing users with callback method.');
// 					resolve(undefined);
// 				})
// 				.catch((error) => {
// 					console.error('Failed to sync users with callback:', error);
// 					reject(error);
// 				});
// 		});
// 	});
// 	await Promise.all(promises);
// 	console.log('Syncing Users completed.');
// }

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
 * Sync projects with the Fast42 API.
 * @param projects The list of projects to sync
 * @returns A promise that resolves when the synchronization is complete
 */
async function syncProjects(projects: any[]): Promise<void> {
	try {
		log(2, `Processing ${projects.length} projects...`);
		const dbProjects = projects.map(transformApiProjectToDb);
		await DatabaseService.insertManyProjects(dbProjects);
		log(2, 'Finished syncing projects.');
	} catch (error) {
		console.error('Failed to sync projects:', error);
		throw error;
	}
}
