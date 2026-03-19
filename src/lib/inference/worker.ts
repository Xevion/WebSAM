import * as Comlink from 'comlink';
import { downloadModel } from './download';
import { createSession, destroySession, getSession } from './session';
import { encodeImage } from './encoder';
import { decodeMask, type DecoderOptions } from './decoder';
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

const api = {
	async downloadAndInit(model: ModelInfo, onProgress: (progress: DownloadProgress) => void): Promise<void> {
		await destroySession();
		cachedEmbedding = null;

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
			await cachePromise;
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
		return decodeMask(session, cachedEmbedding, prompt, options);
	},

	async destroy(): Promise<void> {
		await destroySession();
		cachedEmbedding = null;
	},

	getEmbedding(): ImageEmbedding | null {
		return cachedEmbedding;
	},

	clearEmbedding(): void {
		cachedEmbedding = null;
	},
};

export type InferenceWorkerApi = typeof api;
Comlink.expose(api);
