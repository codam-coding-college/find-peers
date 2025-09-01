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
				user: { select: { login: true, image_url: true } },
				status: true
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
	static async getCampusIdByName(campus_name: string | undefined): Promise<number> {
		if (!campus_name) return -1;

		const campus = await prisma.campus.findFirst({
			where: { name: campus_name },
			select: { id: true }
		});
		return campus?.id ?? -1;
	}

	/**
	 * Retrieve Users based on the given campus.
	 * @param status The campus to filter on.
	 * @returns The list of filtered users.
	 */
	static async getUsersByCampus(campus_id: number): Promise<User[]> {
		return prisma.user.findMany({
			where: { primary_campus_id: campus_id }
		});
	}

	/**
	 * Retrieve Project Users based on the given status.
	 * @param status The project status to filter on.
	 * @returns The list of filtered project users.
	 */
	static async getProjectUsersByStatus(status: string): Promise<ProjectUser[]> {
		return prisma.projectUser.findMany({
			where: { status: status }
		});
    }

	/**
	 * Retrieve Project Users IDs based on the given campus.
	 * @param campus_id The campus ID to filter on.
	 * @returns The list of project user IDs.
	 */
	static async getCampusProjectUsersIds(campus_id: number): Promise<{ user_id: number; }[]> {
		return prisma.projectUser.findMany({
			where: { user: { primary_campus_id: campus_id } },
			select: { user_id: true }
		});
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
	 * @returns The list of all users in ascending (id) order.
	 */
	static async getAllUsers(): Promise<User[]> {
		return prisma.user.findMany({
			orderBy: { id: 'asc' }
		});
	}

	/**
	 * @returns The list of all projects in ascending (id) order.
	 */
	static async getAllProjects(): Promise<Project[]> {
		return prisma.project.findMany({
			orderBy: { id: 'asc' }
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
				slug: true
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
	 * Retrieve campus IDs that are missing from the campus table.
	 * @param users The list of users to check against the database.
	 * @returns The list of missing campus IDs.
	 */
	static async getMissingCampusIds(users: any[]): Promise<number[]> {
		const usersArray = Array.isArray(users) ? users : [users];

		const campusIds = [...new Set(usersArray.map(u => u.primary_campus_id).filter((id) => id !== null && id !== undefined))];
		const existingCampus = await prisma.campus.findMany({
			where: { id: { in: campusIds } },
			select: { id: true }
		});

		const existingCampusIds = new Set(existingCampus.map(c => c.id));
		return campusIds.filter(id => !existingCampusIds.has(id));
	}

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
	 * Inserts a project user into the database.
	 * @param {ProjectUser} projectUser - The project user data to insert.
	 * @returns {Promise<ProjectUser>} - The ID of the inserted project user.
	 */
	static async insertProjectUser(projectUser: ProjectUser): Promise<ProjectUser> {
		try {
			return prisma.projectUser.upsert({
				where: {
					project_id_user_id: {
						user_id: projectUser.user_id,
						project_id: projectUser.project_id
					}
				},
				update: projectUser,
				create: projectUser
			});
		} catch (error) {
			throw new Error(`Failed to insert project user ${projectUser.user_id}: ${getErrorMessage(error)}`);
		}
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
	 * Inserts multiple users into the database.
	 * @param {User} users - The list of user data to insert.
	 * @returns {Promise<void>} - Resolves when the user is inserted.
	 */
	static async insertManyUsers(users: User[]): Promise<void> {
		try {
			const insert = users.map(user => {
				return prisma.user.upsert({
					where: { id: user.id },
					update: user,
					create: user
				});
			});
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
	 * Inserts multiple campuses into the database.
	 * @param campuses - The list of campus data to insert.
	 * @returns {Promise<void>} - Resolves when all campuses are inserted.
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
}
