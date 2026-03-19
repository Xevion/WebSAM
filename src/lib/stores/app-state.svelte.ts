import type {
	ModelInfo,
	Point,
	Box,
	MaskResult,
	DownloadProgress,
	InferenceProgress,
	EmbeddingInfo,
} from '$lib/inference/types';
import { promptHistory } from './prompt-history.svelte';
import { scheduleSave } from './persistence.svelte';
import { deleteCurrentImage } from '$lib/storage/opfs';

export const appState = $state({
	selectedModel: null as ModelInfo | null,
	downloadProgress: { stage: 'idle', bytesDownloaded: 0, totalBytes: 0 } as DownloadProgress,
	isModelReady: false,

	currentImage: null as HTMLImageElement | null,
	imageFile: null as File | null,

	interactionMode: 'point' as 'point' | 'box' | 'everything',
	points: [] as Point[],
	box: null as Box | null,

	/** Cached image embedding from the encoder, cleared on image change. */
	embedding: null as EmbeddingInfo | null,

	maskResult: null as MaskResult | null,
	inferenceProgress: { stage: 'idle' } as InferenceProgress,
	maskOpacity: 0.5,
	maskColor: '#6366f1',
	maskViewMode: 'overlay' as 'overlay' | 'outline' | 'cutout',

	/** Lightweight mask shown during hover (not committed until click). */
	hoverMask: null as ImageData | null,
	/** Whether hover preview is enabled. */
	hoverPreviewEnabled: true,

	webgpuAvailable: false,

	/** Bumped by undo/redo to trigger a decoder re-run. */
	decodeGeneration: 0,
});

export function resetPrompts(): void {
	pushPromptState();
	appState.points = [];
	appState.box = null;
	appState.maskResult = null;
	appState.inferenceProgress = { stage: 'idle' };
	scheduleSave();
}

export function clearEmbedding(): void {
	appState.embedding = null;
}

export function pushPromptState(): void {
	promptHistory.push({ points: [...appState.points], box: appState.box });
}

export function undoLastPrompt(): void {
	const currentState = { points: [...appState.points], box: appState.box };
	const prevState = promptHistory.undo();
	if (!prevState) return;
	promptHistory.pushRedo(currentState);
	appState.points = prevState.points;
	appState.box = prevState.box;
	requestDecode();
}

export function redoLastPrompt(): void {
	const currentState = { points: [...appState.points], box: appState.box };
	const nextState = promptHistory.redo();
	if (!nextState) return;
	promptHistory.pushUndoOnly(currentState);
	appState.points = nextState.points;
	appState.box = nextState.box;
	requestDecode();
}

export function requestDecode() {
	appState.decodeGeneration++;
}

export function clearImage(): void {
	appState.currentImage = null;
	appState.imageFile = null;
	appState.embedding = null;
	appState.hoverMask = null;
	resetPrompts();
	promptHistory.clear();
	void deleteCurrentImage();
	scheduleSave();
}
