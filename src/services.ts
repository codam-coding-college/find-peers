import { PrismaClient, User, Project, Campus, ProjectUser } from '@prisma/client'

const prisma = new PrismaClient();

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
	 * Retrieve user IDs that are missing from the user table.
	 * @param projectUsers The list of project users to check against the database.
	 * @returns The list of missing user IDs.
	 */
	static async getMissingUserIds(projectUsers: any[]): Promise<number[]> {
		const userIds = [...new Set(projectUsers.map(pu => pu.user_id))];

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
		const projectIds = [...new Set(projectUsers.map(pu => pu.project_id))];
		const existingProjects = await prisma.project.findMany({
			where: { id: { in: projectIds } },
			select: {
				id: true,
				name: true,
				slug: true
			}
		});
		const existingProjectIds = new Set(existingProjects.map(p => p.id));
		const missingProjectIds = projectIds.filter(id => !existingProjectIds.has(id));
		const projectDataMap = new Map();
		projectUsers.forEach(pu => {
			if (!projectDataMap.has(pu.project_id)) {
				projectDataMap.set(pu.project_id, {
					id: pu.project_id,
					name: pu.name,
					slug: pu.slug
				});
			}
		});
		return missingProjectIds.map(id => projectDataMap.get(id));
	}

	/**
	 * Retrieve campus IDs that are missing from the campus table.
	 * @param users The list of users to check against the database.
	 * @returns The list of missing campus IDs.
	 */
	static async getMissingCampusIds(users: any[]): Promise<number[]> {
		const campusIds = [...new Set(users.map(u => u.primary_campus_id))];

		const existingCampus = await prisma.campus.findMany({
			where: { id: { in: campusIds } },
			select: { id: true }
		});

		const existingCampusIds = new Set(existingCampus.map(c => c.id));
		return campusIds.filter(id => !existingCampusIds.has(id));
	}


	/*************************************************************************\
	* Insert Methods														  *
	\*************************************************************************/


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
			throw new Error(`Failed to insert user ${campus.id}: ${getErrorMessage(error)}`);
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
