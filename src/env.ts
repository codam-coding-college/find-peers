import { assertEnvInt, assertEnvStr } from './util'

export const DEV_DAYS_LIMIT: number = process.env['DEV_DAYS_LIMIT'] ? parseInt(process.env['DEV_DAYS_LIMIT'] as string) : 365;
export const NODE_ENV = process.env['NODE_ENV'] || 'development';

export interface Env {
	logLevel: 0 | 1 | 2 | 3
	pullTimeout: number
	projectStatuses: typeof projectStatuses
	scope: string[]
	authorizationURL: string
	tokenURL: string
	provider: string
	authPath: string
	tokens: {
		metricsSalt: string
		userAuth: {
			UID: string
			secret: string
			callbackURL: string
		}
		sync: {
			UID: string
			secret: string
			maxRequestPerSecond: number
		}
	}
	userNewStatusThresholdDays: number
}

// known statuses, in the order we want them displayed on the website
const projectStatuses = ['creating_group', 'searching_a_group', 'in_progress', 'waiting_for_correction', 'finished', 'parent'] as const
export type ProjectStatus = (typeof projectStatuses)[number]

export const env: Readonly<Env> = {
	logLevel: process.env['NODE_ENV'] === 'production' ? 3 : 1, // 0 being no logging
	pullTimeout: 24 * 60 * 60 * 1000, // how often to sync with the 42 API (in ms)
	projectStatuses,
	authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
	tokenURL: 'https://api.intra.42.fr/oauth/token',
	provider: '42',
	authPath: '/auth/42',
	scope: ['public'],
	tokens: {
		metricsSalt: assertEnvStr('METRICS_SALT'),
		userAuth: {
			UID: assertEnvStr('USERAUTH_UID'),
			secret: assertEnvStr('USERAUTH_SECRET'),
			callbackURL: assertEnvStr('USERAUTH_CALLBACK_URL'),
		},
		sync: {
			UID: assertEnvStr('SYNC_UID'),
			secret: assertEnvStr('SYNC_SECRET'),
			maxRequestPerSecond: assertEnvInt('SYNC_MAX_REQUESTS_PER_SECOND'),
		},
	},
	userNewStatusThresholdDays: 7,
}
