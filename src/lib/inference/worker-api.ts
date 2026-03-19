import * as Comlink from 'comlink';
import { getLogger } from '@logtape/logtape';
import type { InferenceWorkerApi } from './worker';

const logger = getLogger(['websam', 'inference', 'worker-proxy']);

let worker: Worker | null = null;
let proxy: Comlink.Remote<InferenceWorkerApi> | null = null;

type WorkerErrorListener = (error: Error) => void;
const errorListeners = new Set<WorkerErrorListener>();

/** Subscribe to unrecoverable worker errors (crash, OOM, unhandled exception). */
export function onWorkerError(listener: WorkerErrorListener): () => void {
	errorListeners.add(listener);
	return () => errorListeners.delete(listener);
}

function notifyError(error: Error): void {
	for (const listener of errorListeners) {
		try {
			listener(error);
		} catch {
			// listener shouldn't throw, but don't let it take us down
		}
	}
}

function createWorker(): { worker: Worker; proxy: Comlink.Remote<InferenceWorkerApi> } {
	const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

	w.onerror = (event) => {
		const msg = event.message || 'Worker encountered an unhandled error';
		logger.error('Worker error event', { message: msg });
		notifyError(new Error(msg));
		teardown();
	};

	w.onmessageerror = () => {
		const msg = 'Worker message deserialization failed';
		logger.error('Worker message deserialization failed');
		notifyError(new Error(msg));
		teardown();
	};

	const p = Comlink.wrap<InferenceWorkerApi>(w);
	logger.info('Inference worker created');
	return { worker: w, proxy: p };
}

function teardown(): void {
	worker?.terminate();
	worker = null;
	proxy = null;
	logger.debug('Worker torn down');
}

export function getWorkerApi(): Comlink.Remote<InferenceWorkerApi> {
	if (typeof Worker === 'undefined') {
		throw new Error('Workers are not available in this environment');
	}

	if (proxy) return proxy;

	const created = createWorker();
	worker = created.worker;
	proxy = created.proxy;
	return proxy;
}

/** Whether the worker is currently alive and has a proxy. */
export function isWorkerAlive(): boolean {
	return worker !== null && proxy !== null;
}

/**
 * Restarts the worker, destroying the old one. Callers must re-initialize
 * (download model, encode image, etc.) after calling this.
 */
export function restartWorker(): Comlink.Remote<InferenceWorkerApi> {
	teardown();
	logger.warn('Worker restarted, re-initialization required');
	return getWorkerApi();
}

/**
 * Wraps a Comlink proxy call with a timeout. If the worker doesn't respond
 * within `ms` milliseconds, the returned promise rejects with a timeout error.
 *
 * Usage:
 *   const result = await withTimeout(api.encode(data), 120_000, 'encode');
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			logger.error('Worker call timed out', { label, timeoutMs: ms });
			reject(new Error(`Worker call '${label}' timed out after ${(ms / 1000).toFixed(0)}s`));
		}, ms);

		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(err) => {
				clearTimeout(timer);
				reject(err instanceof Error ? err : new Error(String(err)));
			},
		);
	});
}

export async function terminateWorker(): Promise<void> {
	if (proxy) {
		try {
			await withTimeout(proxy.destroy(), 5_000, 'destroy');
		} catch {
			logger.warn('Graceful worker destroy failed, forcing termination');
		}
	}
	teardown();
}
