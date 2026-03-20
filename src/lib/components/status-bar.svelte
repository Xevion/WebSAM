<script lang="ts">
	import { appState } from '$lib/stores/app-state.svelte';
	import {
		pipeline,
		pipelineState,
		getHoverDebounceFloor,
		getEmaHoverLatency,
		getHoverInferenceRunning,
		getHasPendingDecode,
	} from '$lib/stores/inference-pipeline.svelte';
	import Progress from '$lib/components/ui/progress.svelte';
	import Cpu from '@lucide/svelte/icons/cpu';
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Loader from '@lucide/svelte/icons/loader-circle';
	import Monitor from '@lucide/svelte/icons/monitor';
	import { css } from 'styled-system/css';

	const phase = $derived(pipeline.current);
	const everythingProgress = $derived(appState.everythingProgress);
	const elapsed = $derived(pipelineState.operationElapsedMs);
	const elapsedSec = $derived((elapsed / 1000).toFixed(1));

	const isActive = $derived(phase === 'encoding' || phase === 'decoding' || everythingProgress !== null);
	const isComplete = $derived(
		phase === 'ready' && (pipelineState.lastDecodeMs !== null || pipelineState.lastEncodeMs !== null) && everythingProgress === null,
	);
	const isError = $derived(phase === 'error');

	const isStalled = $derived.by(() => {
		if (phase === 'encoding' && elapsed > 0) {
			return elapsed > pipelineState.emaEncodeMs * 2;
		}
		if (phase === 'decoding' && elapsed > 0 && !everythingProgress) {
			return elapsed > pipelineState.emaDecodeMs * 2;
		}
		return false;
	});

	const stageLabel = $derived.by(() => {
		if (everythingProgress) {
			return `Segmenting: ${everythingProgress.current}/${everythingProgress.total}`;
		}
		switch (phase) {
			case 'encoding': {
				const suffix = isStalled ? ' (slower than usual)' : '';
				return `Encoding image\u2026 ${elapsedSec}s${suffix}`;
			}
			case 'decoding': {
				const suffix = isStalled ? ' (slower than usual)' : '';
				return `Generating mask\u2026 ${elapsedSec}s${suffix}`;
			}
			case 'error':
				return pipelineState.error ?? 'Inference failed';
			case 'ready': {
				const ms = pipelineState.lastDecodeMs ?? pipelineState.lastEncodeMs;
				if (ms !== null) return `Done in ${ms}ms`;
				return 'Ready';
			}
			case 'model-ready':
				return 'Ready \u2014 drop an image';
			case 'no-model':
				return 'Select a model';
			default:
				return 'Waiting';
		}
	});

	const substageLabel = $derived.by(() => {
		if (phase !== 'encoding' || !pipelineState.encodeSubstage) return null;
		return pipelineState.encodeSubstage === 'preprocessing' ? 'Preprocessing' : 'Running encoder';
	});

	const rightLabel = $derived.by(() => {
		if (phase === 'decoding' && getHasPendingDecode()) {
			return '1 queued';
		}
		if (phase === 'encoding' && substageLabel) {
			return substageLabel;
		}
		if (phase === 'ready' || phase === 'decoding') {
			const hoverRunning = getHoverInferenceRunning();
			if (hoverRunning) return 'Hover: \u27f3';
			return `Hover: ~${getEmaHoverLatency()}ms`;
		}
		return null;
	});

	const wrapper = css({
		position: 'relative',
		display: 'flex',
		alignItems: 'center',
		px: '4',
		py: '1.5',
		borderTopWidth: '1px',
		borderColor: 'border',
		bg: 'bg.subtle',
		fontSize: 'xs',
		h: '8',
	});

	const statusRow = css({
		display: 'flex',
		alignItems: 'center',
		gap: '2',
		justifyContent: 'space-between',
		flex: '1',
	});

	const leftGroup = css({
		display: 'flex',
		alignItems: 'center',
		gap: '1.5',
	});

	const rightGroup = css({
		display: 'flex',
		alignItems: 'center',
		gap: '3',
		color: 'fg.muted',
	});

	const spinning = css({
		animation: 'spin 1s linear infinite',
	});

	const gpuBadge = css({
		display: 'inline-flex',
		alignItems: 'center',
		gap: '1',
		color: 'fg.muted',
	});

	const gpuAvailable = css({
		color: 'success.fg',
	});

	const stallColor = css({
		color: 'oklch(0.75 0.15 70)',
	});

	const progressBar = css({
		position: 'absolute',
		bottom: '0',
		left: '0',
		right: '0',
	});

	const progressTrack = css({
		bg: 'bg.emphasis',
		h: '0.5',
		overflow: 'hidden',
	});

	const progressRange = css({
		bg: 'primary',
		h: 'full',
		transition: 'width 200ms ease-out',
	});
</script>

<div class={wrapper}>
	<div class={statusRow}>
		<div class={leftGroup}>
			{#if isComplete}
				<CheckCircle size={14} class={css({ color: 'success.fg', flexShrink: 0 })} />
			{:else if isError}
				<AlertCircle size={14} class={css({ color: 'danger.subtleFg', flexShrink: 0 })} />
			{:else if isActive}
				<Loader size={14} class={spinning} />
			{:else}
				<Cpu size={14} class={css({ color: 'fg.muted', flexShrink: 0 })} />
			{/if}
			<span class={isStalled ? stallColor : ''}>{stageLabel}</span>
		</div>

		<div class={rightGroup}>
			{#if rightLabel}
				<span>{rightLabel}</span>
			{/if}
			<span class={gpuBadge}>
				<Monitor size={12} />
				<span class={appState.webgpuAvailable ? gpuAvailable : ''}>
					WebGPU: {appState.webgpuAvailable ? 'On' : 'Off'}
				</span>
			</span>
		</div>
	</div>

	{#if everythingProgress}
		<Progress
			class={progressBar}
			trackClass={progressTrack}
			rangeClass={progressRange}
			value={everythingProgress.current}
			max={everythingProgress.total}
		/>
	{/if}
</div>
