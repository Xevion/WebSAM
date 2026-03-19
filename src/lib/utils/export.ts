import { maskToBlob, createCutout } from './image';
import { appState } from '$lib/stores/app-state.svelte';

// file-saver is CJS -- dynamic import avoids SSR prerender failures
async function getSaveAs(): Promise<typeof import('file-saver').saveAs> {
	const mod = await import('file-saver');
	return mod.default?.saveAs ?? mod.saveAs;
}

export async function exportMask(): Promise<void> {
	const mask = appState.maskResult?.masks[appState.maskResult.selectedIndex];
	if (!mask) return;
	const blob = await maskToBlob(mask);
	const saveAs = await getSaveAs();
	saveAs(blob, 'websam-mask.png');
}

export async function exportCutout(): Promise<void> {
	const mask = appState.maskResult?.masks[appState.maskResult.selectedIndex];
	if (!mask || !appState.currentImage) return;
	const blob = await createCutout(appState.currentImage, mask);
	const saveAs = await getSaveAs();
	saveAs(blob, 'websam-cutout.png');
}

export async function copyMaskToClipboard(): Promise<void> {
	const mask = appState.maskResult?.masks[appState.maskResult.selectedIndex];
	if (!mask) return;
	const blob = await maskToBlob(mask);
	await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
