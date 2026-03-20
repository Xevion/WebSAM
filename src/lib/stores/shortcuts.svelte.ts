import { registerHotkey } from '@ramstack/hotkey';
import { appState, resetPrompts } from './app-state.svelte';
import { undoAndDecode, redoAndDecode } from './inference-pipeline.svelte';
import { scheduleSave } from './persistence.svelte';
import { exportMask, exportCutout } from '$lib/utils/export';

const SHORTCUTS = [
	{ keys: 'ctrl+z', description: 'Undo last prompt' },
	{ keys: 'ctrl+shift+z', description: 'Redo' },
	{ keys: 'escape', description: 'Clear all prompts' },
	{ keys: 'p', description: 'Point mode' },
	{ keys: 'b', description: 'Box mode' },
	{ keys: 'd', description: 'Download mask' },
	{ keys: 'shift+d', description: 'Download cutout' },
] as const;

export function initShortcuts(): () => void {
	const target = document.documentElement;

	const cleanups = [
		registerHotkey(target, 'ctrl+z', () => undoAndDecode()),
		registerHotkey(target, 'ctrl+shift+z', () => redoAndDecode()),
		registerHotkey(target, 'escape', () => resetPrompts()),
		registerHotkey(target, 'p', (e) => {
			if (shouldIgnore(e)) return;
			appState.interactionMode = 'point';
			scheduleSave();
		}),
		registerHotkey(target, 'b', (e) => {
			if (shouldIgnore(e)) return;
			appState.interactionMode = 'box';
			scheduleSave();
		}),
		registerHotkey(target, 'd', (e) => {
			if (shouldIgnore(e)) return;
			void exportMask();
		}),
		registerHotkey(target, 'shift+d', (e) => {
			if (shouldIgnore(e)) return;
			void exportCutout();
		}),
	];

	return () => {
		for (const cleanup of cleanups) cleanup();
	};
}

function shouldIgnore(event: KeyboardEvent): boolean {
	const target = event.target as HTMLElement;
	return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export { SHORTCUTS };
