export function findLast<T>(arr: T[], predicate: (x: T) => boolean): T | undefined {
	for (let i = arr.length - 1; i >= 0; i--) {
		if (predicate(arr[i] as T))
			return arr[i]
	}
	return undefined
}
