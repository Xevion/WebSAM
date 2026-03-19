import { browser } from '$app/environment';
import { appState } from './app-state.svelte';
import {
	getLastSelectedModelId,
	setLastSelectedModelId,
	getSessionState,
	setSessionState,
} from '$lib/storage/metadata';
import { writeCurrentImage, readCurrentImage, deleteCurrentImage } from '$lib/storage/opfs';
import { MODEL_REGISTRY } from '$lib/inference/models';
import { loadImageFromFile } from '$lib/utils/image';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSave(): void {
	if (!browser) return;
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(() => void saveSession(), 500);
}

async function saveSession(): Promise<void> {
	await setSessionState(
		$state.snapshot({
			points: appState.points,
			box: appState.box,
			hasImage: appState.currentImage !== null,
			maskViewMode: appState.maskViewMode,
			maskOpacity: appState.maskOpacity,
			maskColor: appState.maskColor,
			interactionMode: appState.interactionMode,
		}),
	);

	if (appState.selectedModel) {
		await setLastSelectedModelId(appState.selectedModel.id);
	}
}

export async function restoreSession(): Promise<void> {
	if (!browser) return;

	const lastModelId = await getLastSelectedModelId();
	if (lastModelId) {
		const model = MODEL_REGISTRY.find((m) => m.id === lastModelId);
		if (model) appState.selectedModel = model;
	}

	const session = await getSessionState();
	if (!session) return;

	appState.maskViewMode = session.maskViewMode;
	appState.maskOpacity = session.maskOpacity;
	appState.maskColor = session.maskColor;
	appState.interactionMode = session.interactionMode;
	appState.points = session.points;
	appState.box = session.box;

	if (session.hasImage) {
		const blob = await readCurrentImage();
		if (blob) {
			const file = new File([blob], 'restored-image', { type: blob.type });
			try {
				appState.currentImage = await loadImageFromFile(file);
			} catch {
				await deleteCurrentImage();
			}
		}
	}
}

export async function persistImage(file: File): Promise<void> {
	const buffer = await file.arrayBuffer();
	await writeCurrentImage(buffer);
}
