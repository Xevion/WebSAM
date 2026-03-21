<script lang="ts">
import { appState, resetPrompts, clearImage } from '$lib/stores/app-state.svelte';
import { promptHistory } from '$lib/stores/prompt-history.svelte';
import {
	undoAndDecode,
	redoAndDecode,
	onImageRemoved,
	pipeline,
	runEverythingMode as pipelineRunEverything,
} from '$lib/stores/inference-pipeline.svelte';
import ToggleGroupComponent from '$lib/components/ui/toggle-group.svelte';
import Tooltip from '$lib/components/ui/tooltip.svelte';
import Button from '$lib/components/ui/button.svelte';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Undo2 from '@lucide/svelte/icons/undo-2';
import Redo2 from '@lucide/svelte/icons/redo-2';
import Trash2 from '@lucide/svelte/icons/trash-2';
import DownloadIcon from '@lucide/svelte/icons/download';
import Copy from '@lucide/svelte/icons/copy';
import ImageOff from '@lucide/svelte/icons/image-off';
import Replace from '@lucide/svelte/icons/replace';
import Grid2x2 from '@lucide/svelte/icons/grid-2x2';
import { css } from 'styled-system/css';
import { exportMask, exportCutout, copyMaskToClipboard } from '$lib/utils/export';
import type { HTMLAttributes } from 'svelte/elements';

interface Props {
	onOpenGallery?: () => void;
}

const { onOpenGallery }: Props = $props();

type TooltipProps = (p?: Record<string, unknown>) => HTMLAttributes<HTMLElement>;

const modeItems = [
	{ value: 'point', label: 'Point' },
	{ value: 'box', label: 'Box' },
];

function handleModeChange(value: string[]) {
	const mode = value[0] as 'point' | 'box';
	if (mode) {
		appState.interactionMode = mode;
		resetPrompts();
	}
}

function runEverythingMode() {
	appState.interactionMode = 'everything';
	resetPrompts();
	void pipelineRunEverything();
}

const bar = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	px: '3',
	py: '2',
	bg: 'bg.subtle',
	borderBottomWidth: '1px',
	borderColor: 'border',
	flexWrap: 'wrap',
});

const separator = css({
	w: '1px',
	h: '6',
	bg: 'border',
	mx: '1',
});

const hasMask = $derived(appState.maskResult !== null);
const hasPoints = $derived(appState.points.length > 0);
const hasImage = $derived(appState.currentImage !== null);

let fileInputEl: HTMLInputElement | undefined = $state();

function handleChangeImage(event: Event) {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file?.type.startsWith('image/')) return;
	// Dispatch to the image-canvas handler via a custom event on window
	window.dispatchEvent(new CustomEvent('websam:load-file', { detail: file }));
	input.value = '';
}
</script>

<div class={bar}>
	<ToggleGroupComponent
		items={modeItems}
		value={[appState.interactionMode === 'everything' ? '' : appState.interactionMode]}
		onValueChange={handleModeChange}
	/>

	<Tooltip content="Segment everything">
		{#snippet children(props: TooltipProps)}
			<button
				{...props({
					class: css({
						display: 'inline-flex',
						alignItems: 'center',
						gap: '1.5',
						px: '3',
						py: '1.5',
						fontSize: 'sm',
						fontWeight: 'medium',
						color: 'fg.muted',
						cursor: 'pointer',
						border: 'none',
						bg: 'transparent',
						borderRadius: 'md',
						transition: 'all 150ms',
						_hover: { color: 'fg', bg: 'bg.muted' },
					}),
					onclick: runEverythingMode,
					disabled: pipeline.current !== 'ready' || !appState.currentImage,
				})}
			>
				<Sparkles size={14} />
				Everything
			</button>
		{/snippet}
	</Tooltip>

	<Tooltip content="Demo gallery (G)">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="icon-sm" variant="ghost" onclick={onOpenGallery}>
					<Grid2x2 size={14} />
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<div class={separator}></div>

	<Tooltip content="Undo (Ctrl+Z)">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="icon-sm" variant="ghost" onclick={undoAndDecode} disabled={!promptHistory.canUndo}>
					<Undo2 size={14} />
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<Tooltip content="Redo (Ctrl+Shift+Z)">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="icon-sm" variant="ghost" onclick={redoAndDecode} disabled={!promptHistory.canRedo}>
					<Redo2 size={14} />
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<Tooltip content="Clear all prompts (Esc)">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="icon-sm" variant="ghost" onclick={resetPrompts} disabled={!hasPoints && !appState.box}>
					<Trash2 size={14} />
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<div class={separator}></div>

	<Tooltip content="Download mask as PNG (D)">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="icon-sm" variant="ghost" onclick={exportMask} disabled={!hasMask}>
					<DownloadIcon size={14} />
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<Tooltip content="Download cutout (Shift+D)">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="sm" variant="ghost" onclick={exportCutout} disabled={!hasMask}>
					<DownloadIcon size={14} />
					Cutout
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<Tooltip content="Copy mask to clipboard">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="icon-sm" variant="ghost" onclick={copyMaskToClipboard} disabled={!hasMask}>
					<Copy size={14} />
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<div class={separator}></div>

	<Tooltip content="Change image">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="icon-sm" variant="ghost" onclick={() => fileInputEl?.click()} disabled={!hasImage}>
					<Replace size={14} />
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<Tooltip content="Remove image">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="icon-sm" variant="ghost" onclick={() => { onImageRemoved(); clearImage(); }} disabled={!hasImage}>
					<ImageOff size={14} />
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<input
		bind:this={fileInputEl}
		type="file"
		accept="image/*"
		onchange={handleChangeImage}
		class={css({ position: 'absolute', opacity: 0, w: 0, h: 0 })}
	/>
</div>
