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
	static getLastSyncTimestamp = async function(): Promise<Date | null> {
		const sync = await prisma.sync.findUnique({
			where: { id: 1 },
			select: { last_pull: true }
		});
		if (sync?.last_pull === null || sync?.last_pull === undefined) {
			log(2, `No last sync timestamp found, returning null.`);
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
	 * Retrieve the campus associated with a user.
	 * @param userLogin The login of the user.
	 * @returns The campus information or null if not found.
	 */
	static async getCampusByUser(userLogin: string): Promise<{name: string, id: number} | null> {
		const campus = await prisma.campus.findFirst({
			where: { users: { some: { login: userLogin } } },
			select: { name: true, id: true }
		});
		if (!campus) {
			return null;
		}
		return {name: campus.name, id: campus.id};
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

	/*************************************************************************\
	* Insert Methods														  *
	\*************************************************************************/

	/**
	 * Save the synchronization timestamp.
	 * @param timestamp The timestamp to save
	 */
	static saveSyncTimestamp = async function(timestamp: Date): Promise<void> {
		await prisma.sync.upsert({
			where: { id: 1 },
			update: { last_pull: timestamp.toISOString() },
			create: { id: 1, last_pull: timestamp.toISOString() }
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
					update: projectUser,
					create: projectUser
				})
			);
			await prisma.$transaction(insert);
		} catch (error) {
			throw new Error(`Failed to insert project users: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Inserts a user into the database.
	 * @param {User} user - The user data to insert.
	 * @returns {Promise<User>} - Resolves when the user is inserted.
	 */
	static async insertUser(user: User): Promise<User> {
		try {
			return prisma.user.upsert({
				where: { id: user.id },
				update: user,
				create: user
			});
		} catch (error) {
			throw new Error(`Failed to insert user ${user.id}: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Inserts a campus into the database.
	 * @param campus - The campus data to insert.
	 * @returns {Promise<Campus>} - The ID of the inserted campus.
	 */
	static async insertCampus(campus: Campus): Promise<Campus> {
		try {
			log(2, `-------------Inserted campus`);
			return prisma.campus.upsert({
				where: { id: campus.id },
				update: campus,
				create: campus
			});
		} catch (error) {
			throw new Error(`-------Failed to insert campus ${campus.id}: ${getErrorMessage(error)}`);
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
