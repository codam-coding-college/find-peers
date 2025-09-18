export interface DisplayProject {
	name: string,
	users: {
		login: string,
		image_url: string,
		status: string,
		pool: string,
		new: boolean,
	}[]
}
