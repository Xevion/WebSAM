import * as Comlink from 'comlink';
import { downloadModel } from './download';
import { createSession, destroySession, getSession } from './session';
import { encodeImage } from './encoder';
import { decodeMask, reprocessMasks, type DecoderOptions } from './decoder';
import { readModelFile, writeModelFile } from '../storage/opfs';
import { getCachedModelMeta, setCachedModelMeta } from '../storage/metadata';
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

const api = {
	async downloadAndInit(model: ModelInfo, onProgress: (progress: DownloadProgress) => void): Promise<void> {
		await destroySession();
		cachedEmbedding = null;
		cachedDecodeResult = null;

		const encoderFilename = `${model.id}-encoder`;
		const decoderFilename = `${model.id}-decoder`;

		// Check OPFS cache
		const meta = await getCachedModelMeta(model.id);
		let encoderBuffer: ArrayBuffer | null = null;
		let decoderBuffer: ArrayBuffer | null = null;

		if (meta) {
			encoderBuffer = await readModelFile(meta.encoderFilename);
			decoderBuffer = await readModelFile(meta.decoderFilename);
		}

		if (encoderBuffer && decoderBuffer) {
			onProgress({ stage: 'initializing', bytesDownloaded: model.totalSize, totalBytes: model.totalSize });
			await createSession(model, { encoderBuffer, decoderBuffer });
			return;
		}

		// Cache miss: download and cache
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
				console.warn('Model caching failed (session still active):', e);
			}
		} finally {
			downloadController = null;
		}
	},

	cancelDownload(): void {
		downloadController?.abort();
	},

	async encode(imageData: RawImageData): Promise<EmbeddingInfo> {
		const session = getSession();
		if (!session) throw new Error('No active session');
		cachedEmbedding = await encodeImage(session, imageData);
		return { type: cachedEmbedding.type, ready: true };
	},

	async decode(prompt: PromptInput, options: DecoderOptions): Promise<MaskResult> {
		const session = getSession();
		if (!session || !cachedEmbedding) throw new Error('No session or embedding');
		const result = await decodeMask(session, cachedEmbedding, prompt, options);
		cachedDecodeResult = {
			rawLogits: result.rawLogits,
			scores: [...result.scores],
			selectedIndex: result.selectedIndex,
			lowResMasks: result.lowResMasks,
		};
		return result;
	},

	async rethreshold(
		threshold: number,
		smoothPasses: number,
		outputWidth: number,
		outputHeight: number,
	): Promise<MaskResult | null> {
		if (!cachedDecodeResult) return null;
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
		await destroySession();
		cachedEmbedding = null;
		cachedDecodeResult = null;
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
