import { configureSync, getConsoleSink } from '@logtape/logtape';

/**
 * Initializes structured logging for the main thread.
 * Must be called once at app startup (before any getLogger() calls).
 *
 * Workers have isolated module scope and must call configureWorkerLogging()
 * from their own entry point.
 */
export function setupLogging(): void {
	const isDev = import.meta.env.DEV;

	configureSync({
		reset: true,
		sinks: {
			console: getConsoleSink(),
		},
		loggers: [
			{
				category: ['logtape', 'meta'],
				lowestLevel: 'warning',
				sinks: ['console'],
			},
			{
				category: ['websam'],
				lowestLevel: isDev ? 'debug' : 'info',
				sinks: ['console'],
			},
		],
	});
}

/**
 * Initializes structured logging inside a Web Worker.
 * Separate from setupLogging() because workers have isolated module scope
 * and cannot share LogTape configuration with the main thread.
 */
export function setupWorkerLogging(): void {
	configureSync({
		reset: true,
		sinks: {
			console: getConsoleSink(),
		},
		loggers: [
			{
				category: ['logtape', 'meta'],
				lowestLevel: 'warning',
				sinks: ['console'],
			},
			{
				category: ['websam'],
				lowestLevel: import.meta.env.DEV ? 'debug' : 'info',
				sinks: ['console'],
			},
		],
	});
}
