import { maskToBlob, createCutout } from './image';
import { appState } from '$lib/stores/app-state.svelte';
import { toaster } from '$lib/stores/toast.svelte';
import { errorMessage } from '$lib/utils/error';
import type { saveAs as SaveAsFn } from 'file-saver';

// file-saver is CJS -- dynamic import avoids SSR prerender failures
async function getSaveAs(): Promise<typeof SaveAsFn> {
	const mod = await import('file-saver');
	return mod.default?.saveAs ?? mod.saveAs;
}

export async function exportMask(): Promise<void> {
	try {
		const mask = appState.maskResult?.masks[appState.maskResult.selectedIndex];
		if (!mask) return;
		const blob = await maskToBlob(mask);
		const saveAs = await getSaveAs();
		saveAs(blob, 'websam-mask.png');
		toaster.success({ title: 'Mask exported' });
	} catch (err: unknown) {
		toaster.error({ title: 'Export failed', description: errorMessage(err) });
	}
}

export async function exportCutout(): Promise<void> {
	try {
		const mask = appState.maskResult?.masks[appState.maskResult.selectedIndex];
		if (!mask || !appState.currentImage) return;
		const blob = await createCutout(appState.currentImage, mask);
		const saveAs = await getSaveAs();
		saveAs(blob, 'websam-cutout.png');
		toaster.success({ title: 'Cutout exported' });
	} catch (err: unknown) {
		toaster.error({ title: 'Export failed', description: errorMessage(err) });
	}
}

export async function copyMaskToClipboard(): Promise<void> {
	try {
		const mask = appState.maskResult?.masks[appState.maskResult.selectedIndex];
		if (!mask) return;
		const blob = await maskToBlob(mask);
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
		toaster.success({ title: 'Copied to clipboard' });
	} catch (err: unknown) {
		toaster.error({ title: 'Copy failed', description: errorMessage(err) });
	}
}
