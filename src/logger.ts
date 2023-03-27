import { env, Env } from './env'
import { campusDBs } from './db'

// eg. 24
export function msToHuman(milliseconds: number): string {
	const hours = milliseconds / (1000 * 60 * 60)
	const h = Math.floor(hours)

	const minutes = (hours - h) * 60
	const m = Math.floor(minutes)

	const seconds = (minutes - m) * 60
	const s = Math.floor(seconds)

	return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

function longestKeyLength(obj: Record<string, unknown>): number {
	let longestCampusNameLength = 0
	for (const key in obj) {
		if (key.length > longestCampusNameLength) {
			longestCampusNameLength = key.length
		}
	}
	return longestCampusNameLength
}

export function nowISO(d: Date | number = new Date()): string {
	d = new Date(d)
	return `${d.toISOString().slice(0, -5)}Z`
}

export function logCampus(level: Env['logLevel'], campus: string, project: string, message: string) {
	if (level <= env.logLevel) {
		console.log(`${nowISO()} | ${campus.padEnd(longestKeyLength(campusDBs))} ${project.padEnd(longestKeyLength(env.projectIDs))} | ${message}`)
	}
}

export function log(level: Env['logLevel'], message: string) {
	if (level <= env.logLevel) {
		console.log(`${nowISO()} | ${message}`)
	}
}
