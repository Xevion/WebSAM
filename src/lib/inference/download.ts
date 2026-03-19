import type { ModelBuffers } from './session';
import type { DownloadProgress, ModelInfo } from './types';

/**
 * Fetches a single model file with streaming progress.
 * Works with both local dev server URLs and remote CDN URLs.
 */
async function fetchWithProgress(
	url: string,
	expectedSize: number,
	onProgress: (downloaded: number) => void,
	signal?: AbortSignal,
): Promise<ArrayBuffer> {
	const response = await fetch(url, { signal });

	if (!response.ok) {
		throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
	}

	const contentLength = Number(response.headers.get('Content-Length')) || expectedSize;
	const reader = response.body?.getReader();

	if (!reader) {
		// Fallback: no streaming (e.g., some browsers/servers)
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
 * Returns the raw ArrayBuffers for session creation.
 */
export async function downloadModel(
	model: ModelInfo,
	onProgress: (progress: DownloadProgress) => void,
	signal?: AbortSignal,
): Promise<ModelBuffers> {
	let encoderDownloaded = 0;
	let decoderDownloaded = 0;

	onProgress({
		stage: 'downloading-encoder',
		bytesDownloaded: 0,
		totalBytes: model.totalSize,
	});

	const encoderBuffer = await fetchWithProgress(
		model.encoderUrl,
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

	onProgress({
		stage: 'downloading-decoder',
		bytesDownloaded: encoderDownloaded,
		totalBytes: model.totalSize,
	});

	const decoderBuffer = await fetchWithProgress(
		model.decoderUrl,
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

	onProgress({
		stage: 'initializing',
		bytesDownloaded: model.totalSize,
		totalBytes: model.totalSize,
	});

	return { encoderBuffer, decoderBuffer };
}

/**
 * Check if a model is already cached.
 * Currently always returns false since OPFS caching is not yet implemented.
 */
export function isModelCached(_modelId: string): boolean {
	return false;
}
