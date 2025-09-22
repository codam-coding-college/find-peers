import { env, Env } from './env'

export function nowISO(d: Date | number = new Date()): string {
	d = new Date(d);
	return `${d.toISOString().slice(0, -5)}Z`;
}

export function log(level: Env['logLevel'], message: string) {
	if (level <= env.logLevel) {
		console.log(`${nowISO()} | ${message}`);
	}
}
