<script lang="ts">
import { appState, resetPrompts, undoLastPoint } from '$lib/stores/app-state.svelte';
import ToggleGroupComponent from '$lib/components/ui/toggle-group.svelte';
import Tooltip from '$lib/components/ui/tooltip.svelte';
import Button from '$lib/components/ui/button.svelte';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Undo2 from '@lucide/svelte/icons/undo-2';
import Trash2 from '@lucide/svelte/icons/trash-2';
import DownloadIcon from '@lucide/svelte/icons/download';
import Copy from '@lucide/svelte/icons/copy';
import { css } from 'styled-system/css';
import { exportMask, exportCutout, copyMaskToClipboard } from '$lib/utils/export';
import type { HTMLAttributes } from 'svelte/elements';

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
					disabled: !appState.isModelReady || !appState.currentImage,
				})}
			>
				<Sparkles size={14} />
				Everything
			</button>
		{/snippet}
	</Tooltip>

	<div class={separator}></div>

	<Tooltip content="Undo last point">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="icon-sm" variant="ghost" onclick={undoLastPoint} disabled={!hasPoints}>
					<Undo2 size={14} />
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<Tooltip content="Clear all prompts">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="icon-sm" variant="ghost" onclick={resetPrompts} disabled={!hasPoints && !appState.box}>
					<Trash2 size={14} />
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<div class={separator}></div>

	<Tooltip content="Download mask as PNG">
		{#snippet children(props: TooltipProps)}
			<span {...props()}>
				<Button size="icon-sm" variant="ghost" onclick={exportMask} disabled={!hasMask}>
					<DownloadIcon size={14} />
				</Button>
			</span>
		{/snippet}
	</Tooltip>

	<Tooltip content="Download cutout">
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
</div>
