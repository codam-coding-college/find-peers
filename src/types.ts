export interface DisplayProject {
	name: string,
	slug: string,
	users: {
		login: string,
		image_url: string,
		status: string,
		pool: string,
		new: boolean,
	}[];
}

// 42 API type definitions
export interface ApiUser {
	id: number;
	login: string;
	staff?: boolean;
	campus_users: {
		is_primary: boolean;
		campus_id: number;
	}[];
	image?: {
		versions?: {
			medium?: string;
		};
	};
	pool_month: string;
	pool_year: string;
	anonymize_date?: string | null;
}

export interface ApiProject {
	id: number;
	name?: string;
	slug?: string;
	difficulty?: number;
}

export interface ApiCampus {
	id: number;
	name: string;
}

export interface ApiProjectUser {
	project: {
		id: number;
	};
	user: {
		id: number;
	};
	created_at: string;
	updated_at: string;
	status: string;
}
