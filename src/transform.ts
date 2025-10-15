import { User, Project, Campus, ProjectUser } from '@prisma/client'

/**
 * Transforms 42Api /v2/projects_users data to Database data.
 * @param apiProjectUser Fetched data from the 42Api
 * @returns ProjectUser object for the database
 */
export function transformApiProjectUserToDb(apiProjectUser: any): ProjectUser {
	return {
		project_id: apiProjectUser.project.id,
		user_id: apiProjectUser.user.id,
		created_at: apiProjectUser.created_at,
		updated_at: apiProjectUser.updated_at,
		status: apiProjectUser.status
	};
}

/**
 * Transforms 42Api /v2/users data to Database data.
 * @param apiUser Fetched data from the 42Api
 * @returns User object for the database
 */
export function transformApiUserToDb(apiUser: any): User {
	const primaryCampus = apiUser.campus_users.find((cu: any) => cu.is_primary);
	if (apiUser.staff) {
		// Add prefix to staff logins to make filtering them easier, without storing "staff" boolean in the database
		apiUser.login = '3c3' + apiUser.login;
	}
	return {
		id: apiUser.id,
		login: apiUser.login,
		primary_campus_id: primaryCampus ? primaryCampus.campus_id : 1,
		image_url: apiUser.image?.versions?.medium || null,
		pool: apiUser.pool_month + ' ' + apiUser.pool_year,
		anonymize_date: apiUser.anonymize_date || null
	};
}

/**
 * Transforms 42Api /v2/campus data to Database data.
 * @param apiCampus Fetched data from the 42Api
 * @returns Campus object for the database
 */
export function transformApiCampusToDb(apiCampus: any): Campus {
	return {
		id: apiCampus.id,
		name: apiCampus.name
	};
}

/**
 * Transforms 42Api /v2/projects_users data to Database data.
 * @param apiProjectUser Fetched data from the 42Api
 * @returns Project object for the database
 */
export function transformApiProjectToDb(apiProject: any): Project {
	return {
		id: apiProject.id,
		name: apiProject.name || '',
		slug: apiProject.slug || '',
		difficulty: apiProject.difficulty || undefined
	};
}
