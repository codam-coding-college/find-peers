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
