function assertEnv(env: string): string {
	const value = process.env[env]
	if (value === undefined) {
		throw new Error(`Environment variable "${env}" is not set`)
	}
	return value
}

export function assertEnvStr(env: string): string {
	const value = assertEnv(env)
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`Environment variable "${value}" is not a non-empty string`)
	}
	return value
}

export function assertEnvInt(env: string): number {
	const value = assertEnv(env)
	const num = parseInt(value)
	if (isNaN(num)) {
		throw new Error(`Environment variable "${value}" is not a number`)
	}
	return num
}
