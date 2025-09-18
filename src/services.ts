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
	 * Get the name of a campus by its ID.
	 * @param campus_id The campus ID to look for.
	 * @returns The name of the campus.
	 */
	static async getCampusNameById(campus_id: any): Promise<{ name: string } | null> {
		return prisma.campus.findUnique({
			where: { id: campus_id },
			select: { name: true }
		});
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
	 * Retrieve projects that are missing from the project table.
	 * @param projectUsers The list of project users to check against the database.
	 * @returns The list of missing project IDs.
	 */
	static async getMissingProjects(projectUsers: any[]): Promise<any[]> {
		const projectsArray = Array.isArray(projectUsers) ? projectUsers : [projectUsers];

		const projectIds = [...new Set(projectsArray.map(pu => pu.project.id).filter((id) => id !== null && id !== undefined))];
		const existingProjects = await prisma.project.findMany({
			where: { id: { in: projectIds } },
			select: {
				id: true,
				name: true,
			}
		});
		const existingProjectIds: Set<number> = new Set(existingProjects.map((p: { id: number }) => p.id));
		const missingProjects = projectIds.filter(id => !existingProjectIds.has(id));
		const projectDataMap: Map<number, any> = new Map();
		projectUsers.forEach(pu => {
			if (!projectDataMap.has(pu.project.id)) {
				projectDataMap.set(pu.project.id, pu.project);
			}
		});
		return missingProjects.map(id => {
			const project = projectDataMap.get(id);
			return {
				id,
				name: project.name,
				slug: project.slug
			};
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
	 * Filter project users to only return those that are new or updated
	 * @param projectUsersData Array of project user data from API
	 * @returns Array of project users that need to be processed
	 */
	static async filterNewProjectUsers(projectUsersData: any[]): Promise<any[]> {
		if (projectUsersData.length === 0) return [];

		const projectUserChecks = projectUsersData.map(pu => ({
			user_id: pu.user.id,
			project_id: pu.project.id,
			updated_at: new Date(pu.updated_at)
		}));

		// Get existing project users with their update timestamps
		const existing = await prisma.projectUser.findMany({
			where: {
				OR: projectUserChecks.map(pu => ({
					AND: [
						{ user_id: pu.user_id },
						{ project_id: pu.project_id }
					]
				}))
			},
			select: {
				user_id: true,
				project_id: true,
				updated_at: true
			}
		});

		// Create a lookup map for faster checking
		const existingMap = new Map();
		existing.forEach(pu => { existingMap.set(`${pu.user_id}-${pu.project_id}`, pu.updated_at); });

		// Filter to only new or updated project users
		return projectUsersData.filter(pu => {
			const key = `${pu.user.id}-${pu.project.id}`;
			const existingTimestamp = existingMap.get(key);

			if (!existingTimestamp) {
				return true;
			}

			const apiTimestamp = new Date(pu.updated_at);
			return apiTimestamp > existingTimestamp;
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
	 * Inserts a project into the database.
	 * @param project - The project data to insert.
	 * @returns {Promise<Project>} - Resolves when all projects are inserted.
	 */
	static async insertProject(project: Project): Promise<Project> {
		try {
			return prisma.project.upsert({
				where: { id: project.id },
				update: project,
				create: project
			});
		}
		catch (error) {
			throw new Error(`Failed to insert project ${project.id}: ${getErrorMessage(error)}`);
		}
	}
}
