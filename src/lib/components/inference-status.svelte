<script lang="ts">
import { appState } from '$lib/stores/app-state.svelte';
import Progress from '$lib/components/ui/progress.svelte';
import Cpu from '@lucide/svelte/icons/cpu';
import CheckCircle from '@lucide/svelte/icons/check-circle';
import AlertCircle from '@lucide/svelte/icons/alert-circle';
import Loader from '@lucide/svelte/icons/loader-circle';
import Monitor from '@lucide/svelte/icons/monitor';
import { css } from 'styled-system/css';

const inference = $derived(appState.inferenceProgress);

const stageLabel = $derived.by(() => {
	switch (inference.stage) {
		case 'idle':
			return 'Waiting for input';
		case 'encoding':
			return 'Encoding image...';
		case 'decoding':
			return 'Generating mask...';
		case 'complete':
			return `Done in ${inference.timeMs ?? 0}ms`;
		case 'error':
			return inference.error ?? 'Inference failed';
	}
});

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
		{#if inference.stage === 'complete'}
			<CheckCircle size={16} class={css({ color: 'success.fg', flexShrink: 0 })} />
		{:else if inference.stage === 'error'}
			<AlertCircle size={16} class={css({ color: 'danger.subtleFg', flexShrink: 0 })} />
		{:else if inference.stage === 'encoding' || inference.stage === 'decoding'}
			<Loader size={16} class={spinning} />
		{:else}
			<Cpu size={16} class={css({ color: 'fg.muted', flexShrink: 0 })} />
		{/if}
		<span>{stageLabel}</span>
	</div>

	{#if inference.stage === 'encoding' || inference.stage === 'decoding'}
		<Progress value={null} label={inference.stage === 'encoding' ? 'Encoding' : 'Decoding'} />
	{/if}

	<div class={gpuBadge}>
		<Monitor size={12} />
		<span class={appState.webgpuAvailable ? gpuAvailable : ''}>
			WebGPU: {appState.webgpuAvailable ? 'Available' : 'Unavailable'}
		</span>
	</div>
</div>
