import { User, Project, Campus, ProjectUser } from '@prisma/client'
import { ApiUser, ApiProject, ApiCampus, ApiProjectUser } from './types';

/**
 * Transforms 42Api /v2/projects_users data to Database data.
 * @param apiProjectUser Fetched data from the 42Api
 * @returns ProjectUser object for the database
 */
export function transformApiProjectUserToDb(apiProjectUser: ApiProjectUser): ProjectUser {
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
export function transformApiUserToDb(apiUser: ApiUser, campusId: number | undefined): User {
	let primaryCampus;
	if (campusId === undefined) {
		primaryCampus = apiUser.campus_users.find((cu: any) => cu.is_primary)?.campus_id;
	} else {
		primaryCampus = campusId;
	}
	if (apiUser.staff) {
		// Add prefix to staff logins to make filtering them easier, without storing "staff" boolean in the database.
		// I've chosen a prefix over a boolean to save harddisk space.
		apiUser.login = '3c3' + apiUser.login;
	}
	return {
		id: apiUser.id,
		login: apiUser.login,
		primary_campus_id: primaryCampus ? primaryCampus : 1,
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
export function transformApiCampusToDb(apiCampus: ApiCampus): Campus {
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
export function transformApiProjectToDb(apiProject: ApiProject): Project {
	return {
		id: apiProject.id,
		name: apiProject.name || '',
		slug: apiProject.slug || '',
		difficulty: apiProject.difficulty || null,
	};
}
