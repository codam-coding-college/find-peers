import { AsyncLocalStorage } from 'async_hooks'
import { env } from './env'

export function nowISO(d: Date | number = new Date()): string {
	d = new Date(d);
	return `${d.toISOString().slice(0, -5)}Z`;
}

// Tags every log line emitted within a `withRunId` callback with the same run ID,
// so lines from one sync run can be grepped/correlated without passing an extra
// parameter through every sync function.
const runContext = new AsyncLocalStorage<string>();

export function withRunId<T>(runId: string, fn: () => Promise<T>): Promise<T> {
	return runContext.run(runId, fn);
}

export enum LogLevel {
	ERROR = 0,
	WARN = 1,
	INFO = 2,
	DEBUG = 3,
}

const LEVEL_NAMES: Record<LogLevel, string> = {
	[LogLevel.ERROR]: 'ERROR',
	[LogLevel.WARN]: 'WARN',
	[LogLevel.INFO]: 'INFO',
	[LogLevel.DEBUG]: 'DEBUG',
};

/**
 * Write a log line if the given level is enabled by env.logLevel.
 * @param context Optional extra value (e.g. a caught Error) printed after the message.
 */
function write(level: LogLevel, message: string, context?: unknown): void {
	if (level > env.logLevel) {
		return;
	}
	const runId = runContext.getStore();
	const line = `${nowISO()} | ${LEVEL_NAMES[level]}${runId ? ` | [${runId}]` : ''} | ${message}`;
	let out = console.log;
	if (level === LogLevel.ERROR) {
		out = console.error;
	} else if (level === LogLevel.WARN) {
		out = console.warn;
	}
	if (context === undefined) {
		out(line);
	} else {
		out(line, context);
	}
}

export const log = {
	error: (message: string, context?: unknown): void => write(LogLevel.ERROR, message, context),
	warn: (message: string, context?: unknown): void => write(LogLevel.WARN, message, context),
	info: (message: string, context?: unknown): void => write(LogLevel.INFO, message, context),
	debug: (message: string, context?: unknown): void => write(LogLevel.DEBUG, message, context),
};
