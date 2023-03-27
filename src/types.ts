import { ProjectStatus } from './env'

export interface ApiProject {
	id: number
	occurrence: number
	final_mark: number
	status: ProjectStatus
	'validated?': boolean
	current_team_id: number
	project: {
		id: number
		name: string
		slug: string
		parent_id?: unknown
	}
	cursus_ids: number[]
	marked_at: Date
	marked: boolean
	retriable_at: Date
	created_at: Date
	updated_at: Date
	user: {
		id: number
		email: string
		login: string
		first_name: string
		last_name: string
		usual_full_name: string
		'usual_first_name?': unknown
		url: string
		phone: string
		displayname: string
		kind: string
		image_url: string
		image: {
			link: string
			versions: {
				large: string
				medium: string
				small: string
				micro: string
			}
		}
		new_image_url: string
		'staff?': boolean
		correction_point: number
		pool_month: string
		pool_year: string
		'location?': unknown
		wallet: number
		anonymize_date: Date
		data_erasure_date: Date
		created_at: Date
		updated_at: Date
		'alumnized_at?': unknown
		'alumni?': boolean
		'active?': boolean
	}
	teams: {
		id: number
		name: string
		url: string
		final_mark: number
		project_id: number
		created_at: Date
		updated_at: Date
		status: string
		'terminating_at?': unknown
		users: {
			id: number
			login: string
			url: string
			leader: boolean
			occurrence: number
			validated: boolean
			projects_user_id: number
		}[]
		'locked?': boolean
		'validated?': boolean
		'closed?': boolean
		repo_url: string
		repo_uuid: string
		locked_at: Date
		closed_at: Date
		project_session_id: number
		project_gitlab_path: string
	}[]
}

export interface ProjectSubscriber {
	login: string
	status: ProjectStatus
	staff: boolean
	image_url: string
	lastChangeD: Date | string
	new: boolean
}

export interface Project {
	name: string
	users: ProjectSubscriber[]
}

export interface UserProfile {
	id: number
	login: string
	first_name: string
	displayname: string
	accessToken: string
	refreshToken: string
	campusID: number
	campusName: string
	timeZone: string
}
