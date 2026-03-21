import type { ModelInfo, Point, Box, MaskResult } from '$lib/inference/types';
import { getLogger } from '@logtape/logtape';
import { promptHistory } from './prompt-history.svelte';
import { scheduleSave } from './persistence.svelte';
import { deleteCurrentImage } from '$lib/storage/opfs';

const logger = getLogger(['websam', 'app', 'state']);

export const appState = $state({
	selectedModel: null as ModelInfo | null,

	currentImage: null as HTMLImageElement | null,
	imageFile: null as File | null,

	interactionMode: 'point' as 'point' | 'box' | 'everything',
	points: [] as Point[],
	box: null as Box | null,

	maskResult: null as MaskResult | null,
	maskOpacity: 0.5,
	maskColor: '#6366f1',
	maskViewMode: 'overlay' as 'overlay' | 'outline' | 'cutout',
	maskThreshold: 0.0,
	maskSmoothPasses: 0,

	/** Lightweight mask shown during hover (not committed until click). */
	hoverMask: null as ImageData | null,
	/** Whether hover preview is enabled. */
	hoverPreviewEnabled: true,
	/** Image-space coordinates where the current hover decode was triggered. */
	hoverTriggerPos: null as { x: number; y: number } | null,

	/** Masks from Everything mode, each with an assigned display color. */
	everythingMasks: [] as { mask: ImageData; color: string; score: number }[],
	/** Progress tracker for Everything mode grid segmentation. */
	everythingProgress: null as { current: number; total: number } | null,

	webgpuAvailable: false,
});

export function resetPrompts(): void {
	pushPromptState();
	appState.points = [];
	appState.box = null;
	appState.maskResult = null;
	appState.maskThreshold = 0.0;
	appState.maskSmoothPasses = 0;
	appState.everythingMasks = [];
	appState.everythingProgress = null;
	logger.debug('Prompts reset');
	scheduleSave();
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
	logger.debug('Prompt undone', { restoredPoints: prevState.points.length });
}

export function redoLastPrompt(): void {
	const currentState = { points: [...appState.points], box: appState.box };
	const nextState = promptHistory.redo();
	if (!nextState) return;
	promptHistory.pushUndoOnly(currentState);
	appState.points = nextState.points;
	appState.box = nextState.box;
	logger.debug('Prompt redone', { restoredPoints: nextState.points.length });
}

export function clearImage(): void {
	logger.info('Image cleared');
	appState.currentImage = null;
	appState.imageFile = null;
	appState.hoverMask = null;
	appState.hoverTriggerPos = null;
	appState.everythingMasks = [];
	appState.everythingProgress = null;
	resetPrompts();
	promptHistory.clear();
	void deleteCurrentImage();
	scheduleSave();
}
