import { PrismaClient, User, Project, Campus, ProjectUser } from '@prisma/client'
import { log } from 'console';

const prisma = new PrismaClient();

/**
 * Get a user-friendly error message from an error object.
 * @param error The error object to extract the message from.
 * @returns A user-friendly error message.
 */
function getErrorMessage(error: unknown): string {
	if (error instanceof Error)
		return error.message;
	return String(error);
}

export class DatabaseService {

	/*************************************************************************\
	*  Query Methods														  *
	\*************************************************************************/


	/**
	 * @returns The last synchronization timestamp.
	 */
	static getLastSyncTimestamp = async function(type: string, type_id: number): Promise<Date | null> {
		const sync = await prisma.sync.findUnique({
			where: { type_type_id: { type, type_id } },
			select: { last_pull: true }
		});
		if (sync?.last_pull === null || sync?.last_pull === undefined) {
			return null;
		}
		return new Date(sync.last_pull);
	}

	/**
	 * Get project users by project, status, and campus.
	 * @param project The project to filter by.
	 * @param requestedStatus The status to filter by.
	 * @param campus The campus to filter by.
	 * @returns Project; name. Users; login, image_url. Project Status.
	 */
	static async getProjectUserInfo(
		project_id: any, campus_id: any, requestedStatus: string | undefined): Promise<any[]> {
		const whereClause: any = {
			project_id: project_id,
			user: { primary_campus_id: campus_id }
		};
		if (typeof requestedStatus === 'string' && requestedStatus.length > 0) {
			whereClause.status = requestedStatus;
		}

		const projusers = await prisma.projectUser.findMany({
			where: whereClause,
			select: {
				user: { select: { login: true, image_url: true, pool: true } },
				status: true,
				created_at: true
			}
		});
		if (requestedStatus == 'finished') {
			return projusers;
		}
		return projusers.filter(pu => pu.status !== 'finished');
	}

	/**
	 * Get the ID of a campus by its name.
	 * @param campus_name The campus name to look for.
	 * @returns The ID of the campus.
	 */
	static async getCampusIdByName(campus_name: string | null): Promise<number> {
		if (campus_name === null) return -1;

		const campus = await prisma.campus.findFirst({
			where: { name: campus_name },
			select: { id: true }
		});
		return campus?.id ?? -1;
	}

	/**
	 * @returns The list of all campuses in ascending (name) order.
	 */
	static async getAllCampuses(): Promise<Campus[]> {
		return prisma.campus.findMany({
			orderBy: { name: 'asc' }
		});
	}

	/**
	 * @returns The list of all projects in ascending (difficulty) order.
	 */
	static async getAllProjects(): Promise<Project[]> {
		return prisma.project.findMany({
			orderBy: { difficulty: 'asc'}
		});
	}

	/**
	 * Retrieve the missing campus ID for a user.
	 * @param user The user object from the API.
	 * @returns The missing campus ID or null if not found.
	 */
	static async getMissingCampusId(user: any): Promise<number | null> {
		const campusId = user.campus_users.find((cu: any) => cu.is_primary)?.campus_id;
		if (campusId === null || campusId === undefined) {
			return null;
		}
		const existingCampus = await prisma.campus.findUnique({
			where: { id: campusId },
			select: { id: true }
		});
		if (!existingCampus) {
			return campusId;
		}
		return null;
	}

	/**
	 * Retrieve user IDs that are missing from the user table.
	 * @param projectUsers The list of project users to check against the database.
	 * @returns The list of missing user IDs.
	 */
	static async getMissingUserIds(projectUsers: any[]): Promise<number[]> {
		const usersArray = Array.isArray(projectUsers) ? projectUsers : [projectUsers];

		const userIds = [...new Set(usersArray.map(pu => pu.user.id).filter((id) => id !== null && id !== undefined))];
		const existingUsers = await prisma.user.findMany({
			where: { id: { in: userIds } },
			select: { id: true }
		});

		const existingUserIds = new Set(existingUsers.map(u => u.id));
		return userIds.filter(id => !existingUserIds.has(id));
	}

	/**
	 * Given one or multiple user objects from the API, return the user IDs
	 * for which the primary campus is missing in the database.
	 * @param users One or multiple user objects from the API.
	 * @returns The list of user IDs with missing primary campus in the database.
	 */
	static async getMissingCampusUserIds(users: any[] | any): Promise<number[]> {
		const usersArray = Array.isArray(users) ? users : [users];

		// filter unique campus IDs
		const campusIdsToCheck = usersArray
			.map(u => u?.campus_users?.find((cu: any) => cu.is_primary)?.campus_id ?? null)
			.filter((id): id is number => id !== null && id !== undefined);

		// Fetch existing campuses in one query
		const existingCampuses = campusIdsToCheck.length
			? await prisma.campus.findMany({
				where: { id: { in: campusIdsToCheck } },
				select: { id: true }
			})
			: [];
		const existingCampusIds = new Set(existingCampuses.map(c => c.id));

		// Return user IDs where campusId is null/undefined OR campusId not found in DB
		return usersArray
			.filter(u => u.userId !== null && (u.campusId === null || !existingCampusIds.has(u.campusId)))
			.map(u => u.userId as number);
	}

	/**
	 * Retrieve the campus associated with a user.
	 * @param userLogin The login of the user.
	 * @returns The campus information or null if not found.
	 */
	static async getCampusByUser(userLogin: string): Promise<{name: string, id: number} | null> {
		const user = await prisma.user.findFirst({
			where: { login: userLogin },
			select: { primary_campus_id: true, campus: true },
		});
		if (!user) {
			log(2, `User not found in getCampusByUser: ${userLogin}`);
			return null;
		}
		if (!user.primary_campus_id || !user.campus) {
			log(2, `Campus not assigned for user ${userLogin}`);
			return null;
		}
		return {name: user.campus.name, id: user.campus.id};
	}

	/**
	 * Retrieve a user by their login.
	 * @param login The login of the user to find.
	 * @returns The user object or null if not found.
	 */
	static async findUserByLogin(login: string): Promise<User | null> {
		return prisma.user.findFirst({
			where: { login: login }
		});
	}

	/**
	 * Count the number of unique project users in a specific campus.
	 * @param campusId The ID of the campus to count users in.
	 * @returns The number of unique project users in the specified campus.
	 */
	static async countUniqueProjectUsersInCampus(campusId: number): Promise<number> {
		const uniqueUsers = await prisma.projectUser.groupBy({
			by: ['user_id'],
			where: {
				user: { primary_campus_id: campusId },
				status: { not: 'finished' }
			}
		});
		return uniqueUsers.length;
	}

	/*************************************************************************\
	* Insert Methods														  *
	\*************************************************************************/

	/**
	 * Save the synchronization timestamp.
	 * @param timestamp The timestamp to save
	 */
	static saveSyncTimestamp = async function(type: string, type_id: number, timestamp: Date): Promise<void> {
		await prisma.sync.upsert({
			where: { type_type_id: { type, type_id } },
			update: { last_pull: timestamp.toISOString() },
			create: {
				type,
				type_id,
				last_pull: timestamp.toISOString()
			}
		});
	}

	/**
	 * Inserts multiple project users into the database.
	 * @param projectUsers - The list of project user data to insert.
	 * @returns {Promise<void>} - Resolves when all project users are inserted.
	 */
	static async insertManyProjectUsers(projectUsers: ProjectUser[]): Promise<void> {
		try {
			const insert = projectUsers.map(projectUser =>
				prisma.projectUser.upsert({
					where: {
						project_id_user_id: {
							user_id: projectUser.user_id,
							project_id: projectUser.project_id
						}
					},
					// Only update scalar fields here; do not pass relation objects directly
					update: {
						status: projectUser.status,
						updated_at: projectUser.updated_at || new Date().toISOString(), // use current timestamp if not provided
					},
					// For creation, explicitly connect required relations instead of passing relation objects
					create: {
						status: projectUser.status,
						created_at: projectUser.created_at || new Date().toISOString(), // use current timestamp if not provided
						updated_at: projectUser.updated_at || new Date().toISOString(), // use current timestamp if not provided
						project: { connect: { id: projectUser.project_id } },
						user: { connect: { id: projectUser.user_id } },
					}
				})
			);
			await prisma.$transaction(insert);
		} catch (error) {
			throw new Error(`Failed to insert project users: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Inserts a user into the database.
	 * @param user - The user data to insert.
	 * @returns The inserted user.
	 */
	static async insertUser(user: User): Promise<User> {
		try {
			return prisma.user.upsert({
				where: { id: user.id },
				update: user,
				create: user
			});
		} catch (error) {
			throw new Error(`Failed to insert user ${user.login}: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Inserts multiple users into the database.
	 * @param users - The list of user data to insert.
	 * @returns {Promise<void>} - Resolves when all users are inserted.
	 */
	static async insertManyUsers(users: User[]): Promise<void> {
		try {
			const insert = users.map(user =>
				prisma.user.upsert({
					where: { id: user.id },
					update: user,
					create: user
				})
			);
			await prisma.$transaction(insert);
		} catch (error) {
			throw new Error(`Failed to insert users: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Inserts a campus into the database.
	 * @param campus - The campus data to insert.
	 * @returns {Promise<Campus>} - The ID of the inserted campus.
	 */
	static async insertCampus(campus: Campus): Promise<Campus> {
		try {
			return prisma.campus.upsert({
				where: { id: campus.id },
				update: campus,
				create: campus
			});
		} catch (error) {
			throw new Error(`Failed to insert campus ${campus.id}: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Inserts multiple campuses into the database.
	 * @param campuses - The list of campus data to insert.
	 * @return {Promise<void>} - Resolves when all campuses are inserted.
	 */
	static async insertManyCampuses(campuses: Campus[]): Promise<void> {
		try {
			const insert = campuses.map(campus =>
				prisma.campus.upsert({
					where: { id: campus.id },
					update: campus,
					create: campus
				})
			);
			await prisma.$transaction(insert);
		} catch (error) {
			throw new Error(`Failed to insert campuses: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Inserts multiple projects into the database.
	 * @param projects - The list of project data to insert.
	 * @returns {Promise<void>} - Resolves when all projects are inserted.
	 */
	static async insertManyProjects(projects: Project[]): Promise<void> {
		try {
			const insert = projects.map(project =>
				prisma.project.upsert({
					where: { id: project.id },
					update: project,
					create: project
				})
			);
			await prisma.$transaction(insert);
		} catch (error) {
			throw new Error(`Failed to insert projects: ${getErrorMessage(error)}`);
		}
	}

	/*************************************************************************\
	* Miscellaneous Methods													  *
	\*************************************************************************/

	/**
	 * Delete users who should be anonymized from the database.
	 * @returns {Promise<void>} - Resolves when the operation is complete.
	 */
	static async anonymizeOldEntries(): Promise<void> {
		// Delete project users and users whose anonymization date has passed or login starts with '3b3'
		await prisma.projectUser.deleteMany({
			where: {
				OR: [
					{ user: { anonymize_date: { lt: new Date().toISOString() } } },
					{ user: { login: { startsWith: '3b3' } } }
				]
			}
		});
		await prisma.user.deleteMany({
			where: {
				OR: [
					{ anonymize_date: { lt: new Date().toISOString() } },
					{ login: { startsWith: '3b3' } }
				]
			}
		});
	}
}
