type DateString = string

export interface User {
	id: number
	occurrence: number
	final_mark: number
	status: 'finished' | 'waiting_for_correction' | 'in_progress'
	validated?: boolean
	current_team_id: number
	project: {
		id: number
		name: string
		slug: string
		parent_id?: any
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
		'usual_first_name?': any
		url: string
		phone: string
		displayname: string
		image_url: string
		new_image_url: string
		'staff?': boolean
		correction_point: number
		pool_month: string
		pool_year: string
		'location?': any
		wallet: number
		anonymize_date: Date
		created_at: Date
		updated_at: Date
		alumni: boolean
		is_launched?: boolean
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
		'terminating_at?': any
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
	status: 'finished' | 'waiting_for_correction' | 'in_progress'
	image_url: string
	// startYear: number

}
export interface ProjectSubscribers {
	name: string
	users: ProjectSubscriber[]
}
