import type { DemoImage } from './types';
import { demoImageStore } from './store.svelte';
import { loadImageFromFile } from '$lib/utils/image';
import { appState, resetPrompts } from '$lib/stores/app-state.svelte';
import { clearEmbedding, encodeCurrentImage, getIsModelReady } from '$lib/stores/inference-pipeline.svelte';
import { promptHistory } from '$lib/stores/prompt-history.svelte';

/**
 * Fetch a demo image from CDN and load it into the app state,
 * reusing the same pipeline as user-uploaded images.
 */
export async function loadDemoImage(image: DemoImage): Promise<void> {
	const url = demoImageStore.fullUrl(image);
	if (!url) throw new Error('CDN host not configured');

	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to fetch demo image: ${response.status}`);

	const blob = await response.blob();
	const file = new File([blob], `${image.id}.webp`, { type: blob.type });

	appState.hoverMask = null;
	appState.maskResult = null;
	clearEmbedding();
	promptHistory.clear();
	appState.points = [];
	appState.box = null;

	appState.currentImage = await loadImageFromFile(file);
	appState.imageFile = file;

	if (getIsModelReady()) {
		encodeCurrentImage();
	}
}
