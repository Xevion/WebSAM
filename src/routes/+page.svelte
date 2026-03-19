<script lang="ts">
import { untrack } from 'svelte';
import { appState, requestDecode } from '$lib/stores/app-state.svelte';
import ModelPicker from '$lib/components/model-picker.svelte';
import ModelDownload from '$lib/components/model-download.svelte';
import InferenceStatus from '$lib/components/inference-status.svelte';
import ImageCanvas from '$lib/components/image-canvas.svelte';
import Toolbar from '$lib/components/toolbar.svelte';
import MaskControls from '$lib/components/mask-controls.svelte';
import { getLogger } from '@logtape/logtape';
import { errorMessage } from '$lib/utils/error';
import { css } from 'styled-system/css';
import { browser } from '$app/environment';
import { initShortcuts } from '$lib/stores/shortcuts.svelte';
import { restoreSession } from '$lib/stores/persistence.svelte';
import { onWorkerError } from '$lib/inference/worker-api';
import { initModel } from '$lib/stores/inference-pipeline.svelte';
import { toaster } from '$lib/stores/toast.svelte';
import { onMount } from 'svelte';

const logger = getLogger(['websam', 'app']);

if (browser) {
	appState.webgpuAvailable = 'gpu' in navigator;
	logger.info('WebGPU availability', { available: 'gpu' in navigator });
}

onMount(() => {
	const cleanup = initShortcuts();
	restoreSession()
		.then(() => {
			// After session restore, auto-init the model if one was selected
			if (appState.selectedModel) {
				logger.info('Auto-initializing restored model', { modelId: appState.selectedModel.id });
				void initModel(appState.selectedModel);
			}
		})
		.catch((err: unknown) => {
			logger.error('Session restore failed', { error: errorMessage(err) });
			toaster.error({ title: 'Failed to restore previous session' });
		});

	const unsubWorkerError = onWorkerError((err: Error) => {
		logger.error('Inference worker crashed', { error: err.message });
		appState.isModelReady = false;
		appState.inferenceProgress = {
			stage: 'error',
			error: `Worker crashed: ${err.message}`,
		};
		appState.downloadProgress = {
			stage: 'error',
			bytesDownloaded: 0,
			totalBytes: 0,
			error: 'Worker crashed. Select model to restart.',
		};
		toaster.error({ title: 'Inference worker crashed', description: 'Select model to restart.' });
	});

	return () => {
		cleanup();
		unsubWorkerError();
	};
});

// Effect 2: Auto-encode when model becomes ready and image is loaded but not yet encoded
$effect(() => {
	const ready = appState.isModelReady;
	const hasImage = appState.currentImage !== null;
	const hasEmbedding = appState.embedding !== null;

	if (ready && hasImage && !hasEmbedding) {
		logger.info('Auto-encoding: model ready with unencoded image');
		untrack(() => {
			window.dispatchEvent(new CustomEvent('websam:auto-encode'));
		});
	}
});

// Effect 3: Auto-decode when embedding becomes available and prompts exist
$effect(() => {
	const hasEmbedding = appState.embedding !== null;
	const hasPrompts = appState.points.length > 0 || appState.box !== null;

	if (hasEmbedding && hasPrompts) {
		logger.info('Auto-decoding: embedding ready with existing prompts', {
			numPoints: appState.points.length,
			hasBox: appState.box !== null,
		});
		untrack(() => {
			requestDecode();
		});
	}
});

const pageLayout = css({
	display: 'flex',
	h: 'full',
	overflow: 'hidden',
});

const sidebar = css({
	w: '17rem',
	flexShrink: 0,
	borderRightWidth: '1px',
	borderColor: 'border',
	bg: 'bg.subtle',
	overflowY: 'auto',
	display: 'flex',
	flexDirection: 'column',
	gap: '6',
	p: '4',
});

const sidebarSection = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '3',
});

const sidebarDivider = css({
	h: '1px',
	bg: 'border',
	mx: '-4',
});

const centerArea = css({
	flex: '1',
	display: 'flex',
	flexDirection: 'column',
	minW: '0',
});

const canvasArea = css({
	flex: '1',
	display: 'flex',
	p: '4',
	minH: '0',
});

const rightPanel = css({
	flexShrink: 0,
	borderLeftWidth: '1px',
	borderColor: 'border',
	bg: 'bg.subtle',
	overflowY: 'auto',
	p: '4',
});
</script>

<div class={pageLayout}>
	<aside class={sidebar}>
		<div class={sidebarSection}>
			<ModelPicker />
		</div>

		{#if appState.selectedModel}
			<div class={sidebarDivider}></div>
			<div class={sidebarSection}>
				<ModelDownload />
			</div>
		{/if}

		<div class={sidebarDivider}></div>

		<div class={sidebarSection}>
			<InferenceStatus />
		</div>
	</aside>

	<div class={centerArea}>
		<Toolbar />
		<div class={canvasArea}>
			<ImageCanvas />
		</div>
	</div>

	<aside class={rightPanel}>
		<MaskControls />
	</aside>
</div>
