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
		validated_at: apiProjectUser.marked_at || null,
		status: apiProjectUser.status
	};
}

/**
 * Transforms 42Api /v2/users data to Database data.
 * @param apiUser Fetched data from the 42Api
 * @returns User object for the database
 */
export function transformApiUserToDb(apiUser: any): User {
	let primaryCampus;
	if (apiUser.campus_users && apiUser.campus_users.length > 1) {
		// get campus where campus_users[i].primary is true
		primaryCampus = apiUser.campus_users.find((cu: any) => cu.primary);
	}
	else if (apiUser.campus_users && apiUser.campus_users.length === 1) {
		primaryCampus = apiUser.campus_users[0];
	}

	return {
		id: apiUser.id,
		login: apiUser.login,
		primary_campus_id: primaryCampus ? primaryCampus.campus_id : null,
		image_url: apiUser.image?.versions?.medium || null,
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
		name: apiCampus.name || ''
	};
}

/**
 * Transforms 42Api /v2/projects_users data to Database data.
 * @param apiProjectUser Fetched data from the 42Api
 * @returns Project object for the database
 */
export function transformApiProjectToDb(apiProjectUser: any): Project {
	return {
		id: apiProjectUser.id,
		slug: apiProjectUser.slug,
		name: apiProjectUser.name || '',
	};
}
