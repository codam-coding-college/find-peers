export interface DisplayProject {
	name: string,
	slug: string,
	users: {
		login: string,
		image_url: string,
		status: string,
		pool: string,
		new: boolean,
	}[]
}
