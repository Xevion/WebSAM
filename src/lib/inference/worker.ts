import * as Comlink from 'comlink';
import { getLogger } from '@logtape/logtape';
import { downloadModel } from './download';
import { createSession, destroySession, getSession } from './session';
import { encodeImage } from './encoder';
import { decodeMask, reprocessMasks, type DecoderOptions } from './decoder';
import { readModelFile, writeModelFile } from '../storage/opfs';
import { getCachedModelMeta, setCachedModelMeta } from '../storage/metadata';
import { setupWorkerLogging } from '../logging';
import type {
	ModelInfo,
	RawImageData,
	ImageEmbedding,
	MaskResult,
	PromptInput,
	DownloadProgress,
	EmbeddingInfo,
} from './types';

let cachedEmbedding: ImageEmbedding | null = null;
let downloadController: AbortController | null = null;

// Cached decode output for fast re-threshold/re-smooth without re-running the decoder
interface CachedDecodeResult {
	rawLogits: Float32Array;
	scores: number[];
	selectedIndex: number;
	lowResMasks: Float32Array;
}
let cachedDecodeResult: CachedDecodeResult | null = null;

setupWorkerLogging();
const logger = getLogger(['websam', 'inference', 'worker']);

// Comlink does NOT serialize async handlers — if two messages arrive while the
// first is awaiting, both run concurrently. This causes WebGPU stalls when
// two session.run() calls overlap. This mutex ensures sequential execution.
let workerBusy: Promise<void> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
	const task = workerBusy.then(fn);
	workerBusy = task.then(
		() => undefined,
		() => undefined,
	);
	return task;
}

const api = {
	async downloadAndInit(model: ModelInfo, onProgress: (progress: DownloadProgress) => void): Promise<void> {
		return serialize(async () => {
			await destroySession();
			logger.debug('Previous session destroyed', { modelId: model.id });
			cachedEmbedding = null;
			cachedDecodeResult = null;

			// Include the file extension in the cache key so switching between
			// .onnx and .ort formats (or any future format change) invalidates
			// stale cached entries automatically.
			const encoderExt = model.encoderKey.split('.').pop() ?? 'onnx';
			const decoderExt = model.decoderKey.split('.').pop() ?? 'onnx';
			const encoderFilename = `${model.id}-encoder.${encoderExt}`;
			const decoderFilename = `${model.id}-decoder.${decoderExt}`;

			// Check OPFS cache
			const meta = await getCachedModelMeta(model.id);
			let encoderBuffer: ArrayBuffer | null = null;
			let decoderBuffer: ArrayBuffer | null = null;

			if (meta) {
				encoderBuffer = await readModelFile(meta.encoderFilename);
				decoderBuffer = await readModelFile(meta.decoderFilename);
			}
			logger.debug('OPFS cache lookup', { modelId: model.id, cacheHit: !!(encoderBuffer && decoderBuffer) });

			if (encoderBuffer && decoderBuffer) {
				logger.info('Model loaded from cache', { modelId: model.id, totalSize: model.totalSize });
				onProgress({ stage: 'initializing', bytesDownloaded: model.totalSize, totalBytes: model.totalSize });
				await createSession(model, { encoderBuffer, decoderBuffer });
				return;
			}

			// Cache miss: download and cache
			logger.info('Cache miss, starting download', { modelId: model.id, totalSize: model.totalSize });
			downloadController = new AbortController();
			try {
				const buffers = await downloadModel(model, onProgress, downloadController.signal);

				// Write to OPFS in background while session initializes
				const cachePromise = Promise.all([
					writeModelFile(encoderFilename, buffers.encoderBuffer),
					writeModelFile(decoderFilename, buffers.decoderBuffer),
					setCachedModelMeta({
						modelId: model.id,
						encoderFilename,
						decoderFilename,
						totalSize: model.totalSize,
						cachedAt: Date.now(),
					}),
				]);

				await createSession(model, buffers);

				// Finish caching after session is ready
				try {
					await cachePromise;
				} catch (e) {
					logger.warn('Model caching failed (session still active)', { modelId: model.id, error: String(e) });
				}
			} finally {
				downloadController = null;
			}
		});
	},

	cancelDownload(): void {
		logger.info('Download cancelled');
		downloadController?.abort();
	},

	async encode(
		imageData: RawImageData,
		onSubstage?: (stage: 'preprocessing' | 'inference') => void,
	): Promise<EmbeddingInfo> {
		return serialize(async () => {
			logger.debug('Encoding image', { width: imageData.width, height: imageData.height });
			const session = getSession();
			if (!session) {
				logger.error('Encode called without active session');
				throw new Error('No active session');
			}
			cachedEmbedding = await encodeImage(session, imageData, onSubstage);
			logger.info('Image encoded', { embeddingType: cachedEmbedding.type });
			return { type: cachedEmbedding.type, ready: true };
		});
	},

	async decode(prompt: PromptInput, options: DecoderOptions): Promise<MaskResult> {
		return serialize(async () => {
			const nPoints = prompt.points?.length ?? 0;
			const hasBox = !!prompt.box;
			logger.info(
				`Decode received: ${nPoints} points, box=${hasBox}, output=${options.outputWidth}x${options.outputHeight}`,
			);
			const session = getSession();
			if (!session || !cachedEmbedding) {
				logger.error(`Decode rejected: session=${!!session}, embedding=${!!cachedEmbedding}`);
				throw new Error('No session or embedding');
			}
			const t0 = performance.now();
			const result = await decodeMask(session, cachedEmbedding, prompt, options);
			const elapsed = Math.round(performance.now() - t0);
			logger.info(`Mask decoded in ${elapsed}ms (selected=${result.selectedIndex})`);
			cachedDecodeResult = {
				rawLogits: result.rawLogits,
				scores: [...result.scores],
				selectedIndex: result.selectedIndex,
				lowResMasks: result.lowResMasks,
			};
			return result;
		});
	},

	rethreshold(threshold: number, smoothPasses: number, outputWidth: number, outputHeight: number): MaskResult | null {
		if (!cachedDecodeResult) {
			logger.debug('Rethreshold called without cached decode result');
			return null;
		}
		return reprocessMasks(
			cachedDecodeResult.rawLogits,
			cachedDecodeResult.scores,
			cachedDecodeResult.selectedIndex,
			cachedDecodeResult.lowResMasks,
			outputWidth,
			outputHeight,
			threshold,
			smoothPasses,
		);
	},

	async destroy(): Promise<void> {
		return serialize(async () => {
			await destroySession();
			cachedEmbedding = null;
			cachedDecodeResult = null;
			logger.debug('Worker session destroyed');
		});
	},

	getEmbedding(): ImageEmbedding | null {
		return cachedEmbedding;
	},

	clearEmbedding(): void {
		cachedEmbedding = null;
		cachedDecodeResult = null;
	},
};

export type InferenceWorkerApi = typeof api;
Comlink.expose(api);
