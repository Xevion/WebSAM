import type { DownloadProgress, ModelInfo } from './types';

/**
 * Simulates downloading model files with progress updates.
 * In production, this would fetch ONNX files and cache them
 * using OPFS for large models (SAM2, >50 MB) or Cache API for small ones (SlimSAM).
 */
export async function downloadModel(
	model: ModelInfo,
	onProgress: (progress: DownloadProgress) => void,
	signal?: AbortSignal,
): Promise<void> {
	const stages = [
		{ stage: 'downloading-encoder' as const, size: model.encoderSize },
		{ stage: 'downloading-decoder' as const, size: model.decoderSize },
		{ stage: 'initializing' as const, size: 0 },
	];

	for (const { stage, size } of stages) {
		if (signal?.aborted) throw new DOMException('Download cancelled', 'AbortError');

		if (stage === 'initializing') {
			onProgress({ stage, bytesDownloaded: model.totalSize, totalBytes: model.totalSize });
			await sleep(500);
			continue;
		}

		const chunks = 20;
		const chunkSize = Math.floor(size / chunks);

		for (let i = 0; i <= chunks; i++) {
			if (signal?.aborted) throw new DOMException('Download cancelled', 'AbortError');
			const downloaded = Math.min(i * chunkSize, size);
			onProgress({
				stage,
				bytesDownloaded: stage === 'downloading-decoder' ? model.encoderSize + downloaded : downloaded,
				totalBytes: model.totalSize,
			});
			await sleep(50 + Math.random() * 100);
		}
	}

	onProgress({ stage: 'ready', bytesDownloaded: model.totalSize, totalBytes: model.totalSize });
}

/**
 * Check if a model is already cached (stub: always returns false).
 */
export function isModelCached(_modelId: string): boolean {
	return false;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
