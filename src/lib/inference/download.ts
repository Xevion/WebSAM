import { getLogger } from '@logtape/logtape';
import type { ModelBuffers } from './session';
import type { DownloadProgress, ModelInfo } from './types';
import { getCachedModelMeta } from '../storage/metadata';

const logger = getLogger(['websam', 'inference', 'download']);

/**
 * Resolves an R2 object key to a presigned download URL.
 */
async function resolveModelUrl(key: string): Promise<string> {
	const res = await fetch(`/api/model-url?key=${encodeURIComponent(key)}`);
	if (!res.ok) {
		throw new Error(`Failed to resolve model URL for ${key}: ${res.status}`);
	}
	const { url } = await res.json();
	return url;
}

/**
 * Fetches a single model file with streaming progress.
 */
async function fetchWithProgress(
	url: string,
	expectedSize: number,
	onProgress: (downloaded: number) => void,
	signal?: AbortSignal,
): Promise<ArrayBuffer> {
	const response = await fetch(url, { signal });

	if (!response.ok) {
		logger.error('Download HTTP error', { url, status: response.status, statusText: response.statusText });
		throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
	}

	const contentLength = Number(response.headers.get('Content-Length')) || expectedSize;
	const reader = response.body?.getReader();

	if (!reader) {
		logger.warn('Response not streamable, using arrayBuffer fallback', { url });
		const buffer = await response.arrayBuffer();
		onProgress(buffer.byteLength);
		return buffer;
	}

	// Pre-allocate if we know the total size to avoid 2x memory spike
	if (contentLength > 0) {
		const result = new Uint8Array(contentLength);
		let received = 0;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			result.set(value, received);
			received += value.byteLength;
			onProgress(received);
		}

		return result.buffer;
	}

	// Unknown size: collect chunks and combine
	const chunks: Uint8Array[] = [];
	let received = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		received += value.byteLength;
		onProgress(received);
	}

	const result = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return result.buffer;
}

/**
 * Downloads both encoder and decoder model files with progress updates.
 * Resolves presigned URLs from R2 before fetching.
 */
export async function downloadModel(
	model: ModelInfo,
	onProgress: (progress: DownloadProgress) => void,
	signal?: AbortSignal,
): Promise<ModelBuffers> {
	let encoderDownloaded = 0;
	let decoderDownloaded = 0;

	// Resolve presigned URLs for both model files
	logger.info('Resolving model URLs', { modelId: model.id, encoderKey: model.encoderKey, decoderKey: model.decoderKey });
	const [encoderUrl, decoderUrl] = await Promise.all([
		resolveModelUrl(model.encoderKey),
		resolveModelUrl(model.decoderKey),
	]);

	logger.info('Downloading encoder', { modelId: model.id, expectedSize: model.encoderSize });
	onProgress({
		stage: 'downloading-encoder',
		bytesDownloaded: 0,
		totalBytes: model.totalSize,
	});

	const encoderBuffer = await fetchWithProgress(
		encoderUrl,
		model.encoderSize,
		(downloaded) => {
			encoderDownloaded = downloaded;
			onProgress({
				stage: 'downloading-encoder',
				bytesDownloaded: encoderDownloaded,
				totalBytes: model.totalSize,
			});
		},
		signal,
	);

	logger.info('Downloading decoder', { modelId: model.id, expectedSize: model.decoderSize });
	onProgress({
		stage: 'downloading-decoder',
		bytesDownloaded: encoderDownloaded,
		totalBytes: model.totalSize,
	});

	const decoderBuffer = await fetchWithProgress(
		decoderUrl,
		model.decoderSize,
		(downloaded) => {
			decoderDownloaded = downloaded;
			onProgress({
				stage: 'downloading-decoder',
				bytesDownloaded: encoderDownloaded + decoderDownloaded,
				totalBytes: model.totalSize,
			});
		},
		signal,
	);

	logger.info('Download complete, initializing', { modelId: model.id, totalSize: model.totalSize });
	onProgress({
		stage: 'initializing',
		bytesDownloaded: model.totalSize,
		totalBytes: model.totalSize,
	});

	return { encoderBuffer, decoderBuffer };
}

/**
 * Check if a model is already cached in OPFS.
 */
export async function isModelCached(modelId: string): Promise<boolean> {
	const meta = await getCachedModelMeta(modelId);
	return meta !== undefined;
}
