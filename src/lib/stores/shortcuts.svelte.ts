import { getLogger } from '@logtape/logtape';
import { registerHotkey } from '@ramstack/hotkey';
import { appState, resetPrompts } from './app-state.svelte';
import { undoAndDecode, redoAndDecode } from './inference-pipeline.svelte';
import { scheduleSave } from './persistence.svelte';
import { exportMask, exportCutout } from '$lib/utils/export';

const logger = getLogger(['websam', 'shortcuts']);

const SHORTCUTS = [
	{ keys: 'ctrl+z', description: 'Undo last prompt' },
	{ keys: 'ctrl+shift+z', description: 'Redo' },
	{ keys: 'escape', description: 'Clear all prompts' },
	{ keys: 'p', description: 'Point mode' },
	{ keys: 'b', description: 'Box mode' },
	{ keys: 'd', description: 'Download mask' },
	{ keys: 'shift+d', description: 'Download cutout' },
	{ keys: 'g', description: 'Open demo gallery' },
	{ keys: '?', description: 'Show keyboard shortcuts' },
] as const;

export const shortcutHelp = $state({ open: false });

export const galleryShortcut = $state({ open: false });

export function initShortcuts(): () => void {
	const target = document.documentElement;

	const cleanups = [
		registerHotkey(target, 'ctrl+z', () => {
			logger.debug`Shortcut triggered: ctrl+z (undo)`;
			undoAndDecode();
		}),
		registerHotkey(target, 'ctrl+shift+z', () => {
			logger.debug`Shortcut triggered: ctrl+shift+z (redo)`;
			redoAndDecode();
		}),
		registerHotkey(target, 'escape', () => {
			logger.debug`Shortcut triggered: escape (clear prompts)`;
			resetPrompts();
		}),
		registerHotkey(target, 'p', (e) => {
			if (shouldIgnore(e)) return;
			logger.debug`Shortcut triggered: p (point mode)`;
			appState.interactionMode = 'point';
			scheduleSave();
		}),
		registerHotkey(target, 'b', (e) => {
			if (shouldIgnore(e)) return;
			logger.debug`Shortcut triggered: b (box mode)`;
			appState.interactionMode = 'box';
			scheduleSave();
		}),
		registerHotkey(target, 'd', (e) => {
			if (shouldIgnore(e)) return;
			logger.debug`Shortcut triggered: d (download mask)`;
			void exportMask();
		}),
		registerHotkey(target, 'shift+d', (e) => {
			if (shouldIgnore(e)) return;
			logger.debug`Shortcut triggered: shift+d (download cutout)`;
			void exportCutout();
		}),
		registerHotkey(target, 'g', (e) => {
			if (shouldIgnore(e)) return;
			logger.debug`Shortcut triggered: g (demo gallery)`;
			galleryShortcut.open = !galleryShortcut.open;
		}),
	];

	// `?` requires a raw listener because @ramstack/hotkey matches on
	// event.code, and `?` doesn't correspond to any valid code value.
	// The physical key is Shift+Slash on US layouts, but using event.key
	// is more reliable across keyboard layouts.
	function handleQuestionMark(e: KeyboardEvent) {
		if (e.key !== '?') return;
		if (shouldIgnore(e)) return;
		logger.debug`Shortcut triggered: ? (keyboard shortcuts)`;
		shortcutHelp.open = !shortcutHelp.open;
	}
	target.addEventListener('keydown', handleQuestionMark);

	return () => {
		for (const cleanup of cleanups) cleanup();
		target.removeEventListener('keydown', handleQuestionMark);
	};
}

function shouldIgnore(event: KeyboardEvent): boolean {
	const target = event.target as HTMLElement;
	return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export { SHORTCUTS };
