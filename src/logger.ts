import { env, Env } from './env'

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

export function nowISO(d: Date | number = new Date()): string {
	d = new Date(d)
	return `${d.toISOString().slice(0, -5)}Z`
}

export function log(level: Env['logLevel'], message: string) {
	if (level <= env.logLevel) {
		console.log(`${nowISO()} | ${message}`)
	}
}
