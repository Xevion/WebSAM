import * as Comlink from 'comlink';
import type { InferenceWorkerApi } from './worker';

let worker: Worker | null = null;
let proxy: Comlink.Remote<InferenceWorkerApi> | null = null;

export function getWorkerApi(): Comlink.Remote<InferenceWorkerApi> {
	if (typeof Worker === 'undefined') {
		throw new Error('Workers are not available in this environment');
	}

	if (proxy) return proxy;

	worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
	proxy = Comlink.wrap<InferenceWorkerApi>(worker);
	return proxy;
}

export async function terminateWorker(): Promise<void> {
	if (proxy) {
		try {
			await proxy.destroy();
		} catch {
			/* worker may already be dead */
		}
	}
	worker?.terminate();
	worker = null;
	proxy = null;
}
