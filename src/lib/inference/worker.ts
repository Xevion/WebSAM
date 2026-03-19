import * as Comlink from 'comlink';
import { downloadModel } from './download';
import { createSession, destroySession, getSession } from './session';
import { encodeImage } from './encoder';
import { decodeMask, type DecoderOptions } from './decoder';
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
		downloadController = new AbortController();
		try {
			const buffers = await downloadModel(model, onProgress, downloadController.signal);
			await createSession(model, buffers);
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
