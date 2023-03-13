export function findLast<T>(arr: T[], predicate: (x: T) => boolean): T | undefined {
	for (let i = arr.length - 1; i >= 0; i--) {
		if (predicate(arr[i] as T))
			return arr[i]
	}
	return undefined
}

// get unique elements in array based on equalFn()
export function unique<T>(arr: T[], equalFn: (a: T, b: T) => boolean): T[] {
	return arr.filter((current, pos) => arr.findIndex(x => equalFn(x, current)) === pos)
}

function assertEnv(env: string): string {
	const value = process.env[env]
	if (value === undefined)
		throw new Error(`Environment variable "${env}" is not set`)
	return value
}

export function assertEnvStr(env: string): string {
	const value = assertEnv(env)
	if (typeof value !== 'string' || value.length === 0)
		throw new Error(`Environment variable "${value}" is not a non-empty string`)
	return value
}

export function assertEnvInt(env: string): number {
	const value = assertEnv(env)
	const num = parseInt(value)
	if (isNaN(num))
		throw new Error(`Environment variable "${value}" is not a number`)
	return num
}
