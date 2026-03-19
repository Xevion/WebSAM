import { getLogger } from '@logtape/logtape';
import { appState, clearEmbedding } from './app-state.svelte';
import { getWorkerApi, withTimeout } from '$lib/inference/worker-api';
import { errorMessage } from '$lib/utils/error';
import { isModelCached } from '$lib/inference/download';
import * as Comlink from 'comlink';
import type { ModelInfo } from '$lib/inference/types';

const logger = getLogger(['websam', 'pipeline']);

/**
 * Initiates model download (or cache-load) and ONNX session creation.
 * Safe to call multiple times; will cancel any in-flight download first.
 */
export async function initModel(model: ModelInfo): Promise<void> {
	const snapshot = $state.snapshot(model);
	logger.info('Initializing model', { modelId: snapshot.id, totalSize: snapshot.totalSize });

	const api = getWorkerApi();

	try {
		appState.isModelReady = false;
		clearEmbedding();

		await withTimeout(
			api.downloadAndInit(
				snapshot,
				Comlink.proxy((p) => {
					appState.downloadProgress = p;
				}),
			),
			300_000,
			'downloadAndInit',
		);
		appState.downloadProgress = {
			stage: 'ready',
			bytesDownloaded: snapshot.totalSize,
			totalBytes: snapshot.totalSize,
		};
		appState.isModelReady = true;
		logger.info('Model ready', { modelId: snapshot.id });
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') {
			logger.info('Model init aborted', { modelId: snapshot.id });
			appState.downloadProgress = {
				stage: 'idle',
				bytesDownloaded: 0,
				totalBytes: snapshot.totalSize,
			};
		} else {
			logger.error('Model init failed', {
				modelId: snapshot.id,
				error: errorMessage(err),
			});
			appState.downloadProgress = {
				stage: 'error',
				bytesDownloaded: 0,
				totalBytes: 0,
				error: err instanceof Error ? err.message : 'Unknown error',
			};
		}
	}
}

export function cancelModelInit(): void {
	logger.info('Model init cancellation requested');
	void getWorkerApi().cancelDownload();
}

/**
 * Retry after an error: just calls initModel again with the current selection.
 */
export function retryModelInit(): void {
	if (!appState.selectedModel) return;
	void initModel(appState.selectedModel);
}

/**
 * Check if the selected model's weights are cached in OPFS.
 */
export async function checkModelCached(modelId: string): Promise<boolean> {
	return isModelCached(modelId);
}
