import type { ModelInfo, Point, Box, MaskResult, DownloadProgress, InferenceProgress } from '$lib/inference/types';

export const appState = $state({
	selectedModel: null as ModelInfo | null,
	downloadProgress: { stage: 'idle', bytesDownloaded: 0, totalBytes: 0 } as DownloadProgress,
	isModelReady: false,

	currentImage: null as HTMLImageElement | null,
	imageFile: null as File | null,

	interactionMode: 'point' as 'point' | 'box' | 'everything',
	points: [] as Point[],
	box: null as Box | null,

	maskResult: null as MaskResult | null,
	inferenceProgress: { stage: 'idle' } as InferenceProgress,
	maskOpacity: 0.5,
	maskColor: '#6366f1',
	maskViewMode: 'overlay' as 'overlay' | 'outline' | 'cutout',

	webgpuAvailable: false,
});

export function resetPrompts(): void {
	appState.points = [];
	appState.box = null;
	appState.maskResult = null;
	appState.inferenceProgress = { stage: 'idle' };
}

export function undoLastPoint(): void {
	if (appState.points.length > 0) {
		appState.points = appState.points.slice(0, -1);
	}
}

export function clearImage(): void {
	appState.currentImage = null;
	appState.imageFile = null;
	resetPrompts();
}
