import type { Point, Box } from '$lib/inference/types';

interface PromptSnapshot {
	points: Point[];
	box: Box | null;
}

const MAX_HISTORY = 50;

function createPromptHistory() {
	let undoStack = $state<PromptSnapshot[]>([]);
	let redoStack = $state<PromptSnapshot[]>([]);

	return {
		get canUndo() {
			return undoStack.length > 0;
		},
		get canRedo() {
			return redoStack.length > 0;
		},

		push(snapshot: PromptSnapshot): void {
			undoStack = [...undoStack.slice(-(MAX_HISTORY - 1)), snapshot];
			redoStack = [];
		},

		undo(): PromptSnapshot | undefined {
			if (undoStack.length === 0) return undefined;
			const state = undoStack[undoStack.length - 1]!;
			undoStack = undoStack.slice(0, -1);
			return state;
		},

		pushRedo(snapshot: PromptSnapshot): void {
			redoStack = [...redoStack, snapshot];
		},

		redo(): PromptSnapshot | undefined {
			if (redoStack.length === 0) return undefined;
			const state = redoStack[redoStack.length - 1]!;
			redoStack = redoStack.slice(0, -1);
			return state;
		},

		clear(): void {
			undoStack = [];
			redoStack = [];
		},
	};
}

export const promptHistory = createPromptHistory();
