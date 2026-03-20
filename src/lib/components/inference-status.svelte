<script lang="ts">
import { appState } from '$lib/stores/app-state.svelte';
import { pipeline, pipelineState, getHoverDebounceFloor, getEmaHoverLatency } from '$lib/stores/inference-pipeline.svelte';
import Progress from '$lib/components/ui/progress.svelte';
import Cpu from '@lucide/svelte/icons/cpu';
import CheckCircle from '@lucide/svelte/icons/check-circle';
import AlertCircle from '@lucide/svelte/icons/alert-circle';
import Loader from '@lucide/svelte/icons/loader-circle';
import Monitor from '@lucide/svelte/icons/monitor';
import { css } from 'styled-system/css';

const stageLabel = $derived.by(() => {
	if (appState.everythingProgress) {
		return `Segmenting: ${appState.everythingProgress.current}/${appState.everythingProgress.total}`;
	}
	switch (pipeline.current) {
		case 'encoding':
			return 'Encoding image...';
		case 'decoding':
			return 'Generating mask...';
		case 'error':
			return pipelineState.error ?? 'Inference failed';
		case 'ready': {
			const ms = pipelineState.lastDecodeMs ?? pipelineState.lastEncodeMs;
			if (ms !== null) return `Done in ${ms}ms`;
			return 'Ready';
		}
		case 'model-ready':
			return 'Waiting for input';
		default:
			return 'Waiting for input';
	}
});

const everythingProgress = $derived(appState.everythingProgress);
const isActive = $derived(pipeline.current === 'encoding' || pipeline.current === 'decoding' || everythingProgress !== null);
const isComplete = $derived(
	pipeline.current === 'ready' && (pipelineState.lastDecodeMs !== null || pipelineState.lastEncodeMs !== null) && everythingProgress === null,
);
const isError = $derived(pipeline.current === 'error');

const wrapper = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '2',
});

const statusRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	fontSize: 'sm',
});

const spinning = css({
	animation: 'spin 1s linear infinite',
});

const gpuBadge = css({
	display: 'inline-flex',
	alignItems: 'center',
	gap: '1',
	fontSize: 'xs',
	color: 'fg.muted',
	bg: 'bg.muted',
	px: '2',
	py: '0.5',
	borderRadius: 'full',
});

const gpuAvailable = css({
	color: 'success.fg',
});

const hoverStatsRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	fontSize: 'xs',
	color: 'fg.muted',
});

const sectionLabel = css({
	fontSize: 'xs',
	fontWeight: 'semibold',
	color: 'fg.muted',
	textTransform: 'uppercase',
	letterSpacing: 'wider',
});
</script>

<div class={wrapper}>
	<span class={sectionLabel}>Inference</span>

	<div class={statusRow}>
		{#if isComplete}
			<CheckCircle size={16} class={css({ color: 'success.fg', flexShrink: 0 })} />
		{:else if isError}
			<AlertCircle size={16} class={css({ color: 'danger.subtleFg', flexShrink: 0 })} />
		{:else if isActive}
			<Loader size={16} class={spinning} />
		{:else}
			<Cpu size={16} class={css({ color: 'fg.muted', flexShrink: 0 })} />
		{/if}
		<span>{stageLabel}</span>
	</div>

	{#if everythingProgress}
		<Progress value={everythingProgress.current} max={everythingProgress.total} label={`Segmenting: ${everythingProgress.current}/${everythingProgress.total}`} />
	{:else if isActive}
		<Progress value={null} label={pipeline.current === 'encoding' ? 'Encoding' : 'Decoding'} />
	{/if}

	{#if pipeline.current === 'ready' || pipeline.current === 'decoding'}
		<div class={hoverStatsRow}>
			<span>Hover: ~{getEmaHoverLatency()}ms</span>
			<span>Debounce: {getHoverDebounceFloor()}ms</span>
		</div>
	{/if}

	<div class={gpuBadge}>
		<Monitor size={12} />
		<span class={appState.webgpuAvailable ? gpuAvailable : ''}>
			WebGPU: {appState.webgpuAvailable ? 'Available' : 'Unavailable'}
		</span>
	</div>
</div>
