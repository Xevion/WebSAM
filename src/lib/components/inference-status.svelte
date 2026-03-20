<script lang="ts">
import { appState } from '$lib/stores/app-state.svelte';
import { pipeline, pipelineState } from '$lib/stores/inference-pipeline.svelte';
import Progress from '$lib/components/ui/progress.svelte';
import Cpu from '@lucide/svelte/icons/cpu';
import CheckCircle from '@lucide/svelte/icons/check-circle';
import AlertCircle from '@lucide/svelte/icons/alert-circle';
import Loader from '@lucide/svelte/icons/loader-circle';
import Monitor from '@lucide/svelte/icons/monitor';
import { css } from 'styled-system/css';

const stageLabel = $derived.by(() => {
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

const isActive = $derived(pipeline.current === 'encoding' || pipeline.current === 'decoding');
const isComplete = $derived(
	pipeline.current === 'ready' && (pipelineState.lastDecodeMs !== null || pipelineState.lastEncodeMs !== null),
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

	{#if isActive}
		<Progress value={null} label={pipeline.current === 'encoding' ? 'Encoding' : 'Decoding'} />
	{/if}

	<div class={gpuBadge}>
		<Monitor size={12} />
		<span class={appState.webgpuAvailable ? gpuAvailable : ''}>
			WebGPU: {appState.webgpuAvailable ? 'Available' : 'Unavailable'}
		</span>
	</div>
</div>
