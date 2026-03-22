<script lang="ts">
import { appState } from '$lib/stores/app-state.svelte';
import ModelPicker from '$lib/components/model-picker.svelte';
import ModelDownload from '$lib/components/model-download.svelte';
import ImageCanvas from '$lib/components/image-canvas.svelte';
import StatusBar from '$lib/components/status-bar.svelte';
import Toolbar from '$lib/components/toolbar.svelte';
import MaskControls from '$lib/components/mask-controls.svelte';
import DemoGallery from '$lib/components/demo-gallery.svelte';
import { getLogger } from '@logtape/logtape';
import { errorMessage } from '$lib/utils/error';
import { css } from 'styled-system/css';
import { browser } from '$app/environment';
import { initShortcuts, shortcutHelp, galleryShortcut } from '$lib/stores/shortcuts.svelte';
import { breakpoint } from '$lib/stores/breakpoint.svelte';
import { mobileUI } from '$lib/stores/app-state.svelte';
import Drawer from '$lib/components/ui/drawer.svelte';
import BottomSheet from '$lib/components/ui/bottom-sheet.svelte';
import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
import ShortcutHelp from '$lib/components/shortcut-help.svelte';
import { restoreSession } from '$lib/stores/persistence.svelte';
import { onWorkerError } from '$lib/inference/worker-api';
import { selectModel, handleWorkerError, initPipelineEffects } from '$lib/stores/inference-pipeline.svelte';
import { toaster } from '$lib/stores/toast.svelte';
import { onMount } from 'svelte';

let galleryOpen = $state(false);

$effect(() => {
	if (galleryShortcut.open) {
		galleryOpen = true;
		galleryShortcut.open = false;
	}
});

const logger = getLogger(['websam', 'app']);

if (browser) {
	appState.webgpuAvailable = 'gpu' in navigator;
	logger.info('WebGPU availability', { available: 'gpu' in navigator });
}

onMount(() => {
	const cleanupShortcuts = initShortcuts();
	const cleanupEffects = initPipelineEffects();

	restoreSession()
		.then(() => {
			if (appState.selectedModel) {
				logger.info('Auto-initializing restored model', { modelId: appState.selectedModel.id });
				selectModel(appState.selectedModel);
			}
		})
		.catch((err: unknown) => {
			logger.error('Session restore failed', { error: errorMessage(err) });
			toaster.error({ title: 'Failed to restore previous session' });
		});

	const unsubWorkerError = onWorkerError((err: Error) => {
		logger.error('Inference worker crashed', { error: err.message });
		handleWorkerError(err);
		toaster.error({ title: 'Inference worker crashed', description: 'Select model to restart.' });
	});

	return () => {
		cleanupShortcuts();
		cleanupEffects();
		unsubWorkerError();
	};
});

const pageLayout = css({
	display: 'flex',
	h: 'full',
	overflow: 'hidden',
});

const sidebar = css({
	flexShrink: 0,
	borderRightWidth: '1px',
	borderColor: 'border',
	bg: 'bg.subtle',
	overflowY: 'auto',
	display: 'flex',
	flexDirection: 'column',
	gap: '6',
	p: '4',
	w: { base: '13rem', lg: '17rem' },
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
	p: { base: '1', md: '2', lg: '4' },
	minH: '0',
});

const rightPanel = css({
	w: '17rem',
	flexShrink: 0,
	borderLeftWidth: '1px',
	borderColor: 'border',
	bg: 'bg.subtle',
	overflowY: 'auto',
	p: '4',
});

const helpButton = css({
	position: 'fixed',
	bottom: '3',
	left: '3',
	w: '8',
	h: '8',
	borderRadius: 'full',
	bg: 'bg.subtle',
	color: 'fg.muted',
	border: '1px solid',
	borderColor: 'border',
	cursor: 'pointer',
	zIndex: '40',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	fontSize: 'sm',
	fontWeight: 'bold',
	_hover: { bg: 'bg.muted', color: 'fg' },
});

const maskSheetTrigger = css({
	position: 'fixed',
	bottom: '12',
	right: '3',
	w: '10',
	h: '10',
	borderRadius: 'full',
	bg: 'bg',
	color: 'fg.muted',
	border: '1px solid',
	borderColor: 'border',
	boxShadow: 'md',
	cursor: 'pointer',
	zIndex: '40',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	_hover: { bg: 'bg.subtle', color: 'fg' },
});
</script>

<div class={pageLayout}>
	{#if !breakpoint.isMobile}
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
		</aside>
	{/if}

	<div class={centerArea}>
		<Toolbar onOpenGallery={() => { galleryOpen = true; }} />
		<div class={canvasArea}>
			<ImageCanvas onOpenGallery={() => { galleryOpen = true; }} />
		</div>
		<StatusBar />
	</div>

	{#if breakpoint.isDesktop}
		<aside class={rightPanel}>
			<MaskControls />
		</aside>
	{/if}
</div>

{#if breakpoint.isMobile}
	<Drawer
		open={mobileUI.drawerOpen}
		onOpenChange={(v: boolean) => { mobileUI.drawerOpen = v; }}
		title="Model"
	>
		<div class={sidebarSection}>
			<ModelPicker />
		</div>
		{#if appState.selectedModel}
			<div class={sidebarDivider}></div>
			<div class={sidebarSection}>
				<ModelDownload />
			</div>
		{/if}
	</Drawer>
{/if}

{#if breakpoint.isMobileOrTablet}
	<button
		class={maskSheetTrigger}
		onclick={() => { mobileUI.sheetOpen = true; }}
		aria-label="Mask settings"
	>
		<SlidersHorizontal size={18} />
	</button>

	<BottomSheet
		open={mobileUI.sheetOpen}
		onOpenChange={(v: boolean) => { mobileUI.sheetOpen = v; }}
		title="Mask Controls"
	>
		<MaskControls />
	</BottomSheet>
{/if}

{#if !breakpoint.isMobile}
	<button class={helpButton} onclick={() => (shortcutHelp.open = true)} aria-label="Keyboard shortcuts">
		?
	</button>
{/if}

<ShortcutHelp open={shortcutHelp.open} onOpenChange={(v: boolean) => { shortcutHelp.open = v; }} />

<DemoGallery open={galleryOpen} onOpenChange={(o: boolean) => { galleryOpen = o; }} />
