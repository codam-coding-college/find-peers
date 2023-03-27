export function findLast<T>(arr: T[], predicate: (x: T) => boolean): T | undefined {
	for (let i = arr.length - 1; i >= 0; i--) {
		if (predicate(arr[i] as T)) return arr[i]
	}
	return undefined
}

// get unique elements in array based on equalFn()
export function unique<T>(arr: T[], equalFn: (a: T, b: T) => boolean): T[] {
	return arr.filter((current, pos) => arr.findIndex(x => equalFn(x, current)) === pos)
}

// ignoring case, whitespace, -, _, non ascii chars
export function isLinguisticallySimilar(a: string, b: string): boolean {
	a = a
		.toLowerCase()
		.replace(/\s|-|_/g, '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036F]/g, '')
	b = b
		.toLowerCase()
		.replace(/\s|-|_/g, '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036F]/g, '')
	return a === b
}

function assertEnv(env: string): string {
	const value = process.env[env]
	if (value === undefined) throw new Error(`Environment variable "${env}" is not set`)
	return value
}

export function assertEnvStr(env: string): string {
	const value = assertEnv(env)
	if (typeof value !== 'string' || value.length === 0) throw new Error(`Environment variable "${value}" is not a non-empty string`)
	return value
}

export function assertEnvInt(env: string): number {
	const value = assertEnv(env)
	const num = parseInt(value)
	if (isNaN(num)) throw new Error(`Environment variable "${value}" is not a number`)
	return num
}

export function mapObject<Key extends string | number | symbol, Value, NewValue>(object: Record<Key, Value>, mapFn: (key: Key, value: Value) => NewValue): Record<Key, NewValue> {
	const newObj: Record<Key, NewValue> = {} as Record<Key, NewValue>

	for (const key in object) {
		newObj[key] = mapFn(key, object[key])
	}
	return newObj
}
