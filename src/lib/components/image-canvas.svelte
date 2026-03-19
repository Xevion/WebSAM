<script lang="ts">
import { untrack } from 'svelte';
import { appState, resetPrompts, clearEmbedding, pushPromptState } from '$lib/stores/app-state.svelte';
import { loadImageFromFile, computeFit, canvasToImageCoords, imageToRawData } from '$lib/utils/image';
import { scheduleSave, persistImage } from '$lib/stores/persistence.svelte';
import {
	drawPointMarker,
	drawBoxOutline,
	drawCrosshair,
	drawHoverTriggerMarker,
	renderImageLayer,
	renderMaskLayer,
	renderHoverDeltaLayer,
	invalidateAllLayers,
} from '$lib/utils/canvas';
import { getWorkerApi, withTimeout } from '$lib/inference/worker-api';
import type { Point, Box } from '$lib/inference/types';
import { errorMessage } from '$lib/utils/error';
import type { PanzoomObject } from '@panzoom/panzoom';
import Upload from '@lucide/svelte/icons/upload';
import ImageIcon from '@lucide/svelte/icons/image';
import ZoomIn from '@lucide/svelte/icons/zoom-in';
import ZoomOut from '@lucide/svelte/icons/zoom-out';
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import { getLogger } from '@logtape/logtape';
import { css, cx } from 'styled-system/css';

const logger = getLogger(['websam', 'ui', 'canvas']);

let canvasEl: HTMLCanvasElement | undefined = $state();
let containerEl: HTMLDivElement | undefined = $state();
let panzoomEl: HTMLDivElement | undefined = $state();
let panzoomInstance: PanzoomObject | undefined = $state();
let isDragging = $state(false);
let dragStart: { x: number; y: number } | null = $state(null);
let mousePos = $state({ x: 0, y: 0 });
let isDropHover = $state(false);
let rethresholdTimer: ReturnType<typeof setTimeout> | null = null;
let decodeRequestId = 0;
let hoverRequestId = 0;

// Single-inflight + drain-latest hover decode state
let hoverInferenceRunning = false;
let hoverPendingCoords: { cx: number; cy: number } | null = null;
let hoverDebounceTimer: ReturnType<typeof setTimeout> | null = null;
// EMA of hover decode latency for adaptive debounce floor
const EMA_ALPHA = 0.2;
let emaHoverLatency = 150; // initial estimate, converges quickly
/** Adaptive debounce floor: ~30% of measured decode latency, clamped to [16, 300]ms */
function getHoverDebounceFloor(): number {
	return Math.max(16, Math.min(300, Math.round(emaHoverLatency * 0.3)));
}

let canvasWidth = $state(800);
let canvasHeight = $state(600);

$effect(() => {
	if (!containerEl) return;

	canvasWidth = containerEl.clientWidth;
	canvasHeight = containerEl.clientHeight;

	const observer = new ResizeObserver((entries) => {
		const entry = entries[0];
		if (!entry) return;
		canvasWidth = entry.contentRect.width;
		canvasHeight = entry.contentRect.height;
	});
	observer.observe(containerEl);
	return () => observer.disconnect();
});

$effect(() => {
	if (!panzoomEl || !containerEl) return;

	const el = panzoomEl;
	const container = containerEl;
	let instance: PanzoomObject | undefined;

	// Dynamic import avoids SSR evaluation of this DOM-only CJS library
	void import('@panzoom/panzoom').then(({ default: Panzoom }) => {
		if (!el.isConnected) return;

		instance = Panzoom(el, {
			maxScale: 20,
			minScale: 0.1,
			contain: 'outside',
			cursor: 'default',
			handleStartEvent: (event: Event) => {
				if (event instanceof MouseEvent && event.button === 1) {
					event.preventDefault();
					event.stopPropagation();
				}
			},
			noBind: true,
		});

		el.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('pointermove', onPointerMove);
		document.addEventListener('pointerup', onPointerUp);
		container.addEventListener('wheel', onWheel, { passive: false });

		panzoomInstance = instance;
	});

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 1) return;
		event.preventDefault();
		instance?.handleDown(event);
	}
	function onPointerMove(event: PointerEvent) {
		instance?.handleMove(event);
	}
	function onPointerUp(event: PointerEvent) {
		instance?.handleUp(event);
	}
	function onWheel(event: WheelEvent) {
		instance?.zoomWithWheel(event);
	}

	return () => {
		el.removeEventListener('pointerdown', onPointerDown);
		document.removeEventListener('pointermove', onPointerMove);
		document.removeEventListener('pointerup', onPointerUp);
		container.removeEventListener('wheel', onWheel);
		instance?.destroy();
		panzoomInstance = undefined;
	};
});

// getBoundingClientRect() reflects CSS transforms, so we can derive
// canvas-space coords by comparing visual size to intrinsic pixel size
function screenToCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
	const canvasRect = canvasEl!.getBoundingClientRect();
	const scaleX = canvasRect.width / canvasEl!.width;
	const scaleY = canvasRect.height / canvasEl!.height;
	return {
		x: (clientX - canvasRect.left) / scaleX,
		y: (clientY - canvasRect.top) / scaleY,
	};
}

const fit = $derived(
	appState.currentImage
		? computeFit(appState.currentImage.naturalWidth, appState.currentImage.naturalHeight, canvasWidth, canvasHeight)
		: { scale: 1, offsetX: 0, offsetY: 0 },
);

$effect(() => {
	if (!canvasEl) return;
	const ctx = canvasEl.getContext('2d');
	if (!ctx) return;

	canvasEl.width = canvasWidth;
	canvasEl.height = canvasHeight;
	ctx.clearRect(0, 0, canvasWidth, canvasHeight);

	if (!appState.currentImage) return;

	const { scale, offsetX, offsetY } = fit;
	const img = appState.currentImage;
	const mask = appState.maskResult?.masks[appState.maskResult.selectedIndex] ?? null;

	// Layer 1: Image (cached)
	const imgLayer = renderImageLayer(img, canvasWidth, canvasHeight, fit);
	ctx.drawImage(imgLayer, 0, 0);

	// Layer 2: Mask (cached)
	if (mask && appState.maskViewMode === 'cutout') {
		// Cutout replaces the image layer
		const cutoutLayer = renderMaskLayer(
			mask,
			appState.maskColor,
			appState.maskOpacity,
			'cutout',
			scale,
			offsetX,
			offsetY,
			img,
			canvasWidth,
			canvasHeight,
		);
		if (cutoutLayer) {
			ctx.clearRect(0, 0, canvasWidth, canvasHeight);
			ctx.drawImage(cutoutLayer, 0, 0);
		}
	} else if (mask) {
		const maskLayer = renderMaskLayer(
			mask,
			appState.maskColor,
			appState.maskOpacity,
			appState.maskViewMode,
			scale,
			offsetX,
			offsetY,
			null,
			canvasWidth,
			canvasHeight,
		);
		if (maskLayer) ctx.drawImage(maskLayer, 0, 0);
	}

	// Layer 3: Hover delta (cached) — always available in point mode
	if (appState.hoverMask && appState.interactionMode === 'point') {
		const hoverLayer = renderHoverDeltaLayer(
			appState.hoverMask,
			mask,
			scale,
			offsetX,
			offsetY,
			canvasWidth,
			canvasHeight,
		);
		if (hoverLayer) ctx.drawImage(hoverLayer, 0, 0);
	}

	// Layer 3b: Hover trigger marker -- shows where the hover decode was triggered
	if (appState.hoverMask && appState.hoverTriggerPos && appState.interactionMode === 'point') {
		drawHoverTriggerMarker(
			ctx,
			appState.hoverTriggerPos.x,
			appState.hoverTriggerPos.y,
			mousePos.x,
			mousePos.y,
			scale,
			offsetX,
			offsetY,
		);
	}

	// Layer 4: Interaction (drawn directly, cheap)
	for (const point of appState.points) {
		drawPointMarker(ctx, point, scale, offsetX, offsetY);
	}

	if (appState.box) {
		drawBoxOutline(ctx, appState.box, scale, offsetX, offsetY);
	}

	if (appState.interactionMode === 'point' && appState.currentImage) {
		drawCrosshair(ctx, mousePos.x, mousePos.y);
	}
});

// Listen for image replacement from toolbar
$effect(() => {
	function onLoadFile(e: Event) {
		const file = (e as CustomEvent<File>).detail;
		if (!file) return;
		const dt = new DataTransfer();
		dt.items.add(file);
		void handleFileDrop(dt.files);
	}
	function onAutoEncode() {
		logger.info('Auto-encode triggered');
		void runEncoder();
	}
	window.addEventListener('websam:load-file', onLoadFile);
	window.addEventListener('websam:auto-encode', onAutoEncode);
	return () => {
		window.removeEventListener('websam:load-file', onLoadFile);
		window.removeEventListener('websam:auto-encode', onAutoEncode);
	};
});

// Clear hover state and layer caches when interaction mode or image changes
$effect(() => {
	void appState.interactionMode;
	void appState.currentImage;
	appState.hoverMask = null;
	appState.hoverTriggerPos = null;
	invalidateAllLayers();
	if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);
});

// Re-run decoder when undo/redo bumps the generation counter
$effect(() => {
	const gen = appState.decodeGeneration;
	if (gen > 0) {
		untrack(() => {
			void runDecoder([...appState.points], appState.box ? { ...appState.box } : null);
		});
	}
});

// Debounced rethreshold when threshold or smoothing changes
$effect(() => {
	const threshold = appState.maskThreshold;
	const smoothPasses = appState.maskSmoothPasses;

	if (rethresholdTimer) clearTimeout(rethresholdTimer);
	rethresholdTimer = setTimeout(() => {
		untrack(() => {
			if (!appState.maskResult || !appState.currentImage) return;
			const api = getWorkerApi();
			void withTimeout(
				api.rethreshold(
					threshold,
					smoothPasses,
					appState.currentImage.naturalWidth,
					appState.currentImage.naturalHeight,
				),
				30_000,
				'rethreshold',
			)
				.then((result) => {
					if (result) appState.maskResult = result;
				})
				.catch((err) => {
					logger.error('Rethreshold failed', { error: errorMessage(err) });
				});
		});
	}, 150);
});

async function handleFileDrop(files: FileList | null) {
	if (!files || files.length === 0) return;
	const file = files[0];
	if (!file?.type.startsWith('image/')) return;

	appState.imageFile = file;
	try {
		appState.currentImage = await loadImageFromFile(file);
		resetPrompts();
		clearEmbedding();
		await persistImage(file);
		scheduleSave();
		logger.info('Image loaded', {
			fileName: file.name,
			width: appState.currentImage?.naturalWidth,
			height: appState.currentImage?.naturalHeight,
		});

		if (appState.isModelReady) {
			await runEncoder();
		}
	} catch {
		logger.error('Failed to load image', { fileName: file?.name });
		appState.currentImage = null;
	}
}

async function runEncoder() {
	if (!appState.currentImage) return;

	logger.info('Starting image encode');
	const api = getWorkerApi();
	appState.inferenceProgress = { stage: 'encoding' };
	const start = performance.now();
	try {
		const rawData = imageToRawData(appState.currentImage);
		appState.embedding = await withTimeout(api.encode(rawData), 120_000, 'encode');
		const elapsed = Math.round(performance.now() - start);
		logger.info('Image encoded', { elapsed });
		appState.inferenceProgress = { stage: 'complete', timeMs: elapsed };
	} catch (err) {
		logger.error('Image encoding failed', { error: errorMessage(err) });
		appState.inferenceProgress = {
			stage: 'error',
			error: err instanceof Error ? err.message : 'Encoding failed',
		};
	}
}

async function runDecoder(points: Point[], box: Box | null) {
	if (!appState.embedding) {
		logger.warn('Decode skipped: no embedding available');
		return;
	}
	if (!appState.currentImage) {
		logger.warn('Decode skipped: no image loaded');
		return;
	}

	logger.debug('Starting decode request', { numPoints: points.length, hasBox: !!box });
	const myId = ++decodeRequestId;
	const api = getWorkerApi();
	appState.inferenceProgress = { stage: 'decoding' };
	const start = performance.now();

	try {
		const previousMask = appState.maskResult?.lowResMasks ?? null;
		// For refinement, extract the selected mask channel from low_res_masks
		let maskInput: Float32Array | null = null;
		if (previousMask && appState.maskResult) {
			const idx = appState.maskResult.selectedIndex;
			maskInput = new Float32Array(256 * 256);
			maskInput.set(previousMask.subarray(idx * 256 * 256, (idx + 1) * 256 * 256));
		}

		const result = await withTimeout(
			api.decode(
				{
					points: points.length > 0 ? $state.snapshot(points) : undefined,
					box: box ? $state.snapshot(box) : undefined,
				},
				{
					maskInput,
					outputWidth: appState.currentImage.naturalWidth,
					outputHeight: appState.currentImage.naturalHeight,
				},
			),
			60_000,
			'decode',
		);
		if (myId !== decodeRequestId) {
			logger.debug('Stale decode result discarded');
			return;
		}
		const elapsed = Math.round(performance.now() - start);
		logger.info('Decode round-trip complete', { elapsed });
		appState.maskResult = result;
		appState.inferenceProgress = { stage: 'complete', timeMs: elapsed };
	} catch (err) {
		logger.error('Decode failed', { error: errorMessage(err) });
		appState.inferenceProgress = {
			stage: 'error',
			error: err instanceof Error ? err.message : 'Decoding failed',
		};
	}
}

function handleCanvasClick(event: MouseEvent) {
	appState.hoverMask = null;
	appState.hoverTriggerPos = null;
	if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);

	if (!appState.currentImage) {
		logger.debug('Click ignored: no image loaded');
		return;
	}
	if (!appState.isModelReady) {
		logger.warn('Click ignored: model not ready');
		return;
	}
	if (appState.interactionMode !== 'point') return;
	if (!canvasEl) return;

	const { x: cx, y: cy } = screenToCanvasCoords(event.clientX, event.clientY);
	const { x, y } = canvasToImageCoords(cx, cy, fit.scale, fit.offsetX, fit.offsetY);

	if (x < 0 || y < 0 || x >= appState.currentImage.naturalWidth || y >= appState.currentImage.naturalHeight) return;

	// Right-click or shift+click = negative (label 0), left-click = positive (label 1)
	const label: 0 | 1 = event.button === 2 || event.shiftKey ? 0 : 1;
	pushPromptState();
	const newPoints = [...appState.points, { x, y, label }];
	appState.points = newPoints;
	scheduleSave();
	void runDecoder(newPoints, null);
}

function handleContextMenu(event: MouseEvent) {
	if (!appState.currentImage || !appState.isModelReady) {
		logger.debug('Context menu click ignored: image or model not ready');
		return;
	}
	if (appState.interactionMode !== 'point') return;

	// Prevent browser context menu and handle as negative point click
	event.preventDefault();
	handleCanvasClick(event);
}

function handleMouseDown(event: MouseEvent) {
	if (appState.interactionMode !== 'box' || !appState.currentImage) return;
	if (!canvasEl) return;

	const { x: cx, y: cy } = screenToCanvasCoords(event.clientX, event.clientY);
	const { x, y } = canvasToImageCoords(cx, cy, fit.scale, fit.offsetX, fit.offsetY);

	pushPromptState();
	isDragging = true;
	dragStart = { x, y };
	appState.box = { x1: x, y1: y, x2: x, y2: y };
}

function handleMouseMove(event: MouseEvent) {
	if (!canvasEl) return;

	const { x: cx, y: cy } = screenToCanvasCoords(event.clientX, event.clientY);
	mousePos = { x: cx, y: cy };

	if (isDragging && dragStart && appState.interactionMode === 'box') {
		const { x, y } = canvasToImageCoords(mousePos.x, mousePos.y, fit.scale, fit.offsetX, fit.offsetY);
		appState.box = { x1: dragStart.x, y1: dragStart.y, x2: x, y2: y };
	}

	// Adaptive hover preview: debounce with EMA-tuned floor, single-inflight + drain-latest
	if (
		appState.hoverPreviewEnabled &&
		appState.interactionMode === 'point' &&
		appState.currentImage &&
		appState.embedding &&
		!isDragging
	) {
		if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);
		hoverDebounceTimer = setTimeout(() => {
			void scheduleHoverDecode(mousePos.x, mousePos.y);
		}, getHoverDebounceFloor());
	}
}

/**
 * Single-inflight guard: if the GPU is busy, stash the latest cursor position
 * and drain it when the current decode finishes. Never queues more than one
 * pending call, so GPU work never stacks.
 */
function scheduleHoverDecode(cx: number, cy: number): Promise<void> {
	if (hoverInferenceRunning) {
		hoverPendingCoords = { cx, cy };
		return Promise.resolve();
	}
	return runHoverDecode(cx, cy);
}

async function runHoverDecode(cx: number, cy: number): Promise<void> {
	if (!appState.currentImage || !appState.embedding) return;
	const { x, y } = canvasToImageCoords(cx, cy, fit.scale, fit.offsetX, fit.offsetY);
	if (x < 0 || y < 0 || x >= appState.currentImage.naturalWidth || y >= appState.currentImage.naturalHeight) {
		appState.hoverMask = null;
		appState.hoverTriggerPos = null;
		return;
	}

	hoverInferenceRunning = true;
	const myId = ++hoverRequestId;
	const api = getWorkerApi();
	const t0 = performance.now();
	try {
		const hoverPoints: Point[] = [...$state.snapshot(appState.points), { x, y, label: 1 as const }];
		const result = await withTimeout(
			api.decode(
				{ points: hoverPoints },
				{
					maskInput: null,
					outputWidth: appState.currentImage.naturalWidth,
					outputHeight: appState.currentImage.naturalHeight,
				},
			),
			30_000,
			'hover-decode',
		);
		const elapsed = performance.now() - t0;
		emaHoverLatency = EMA_ALPHA * elapsed + (1 - EMA_ALPHA) * emaHoverLatency;
		if (myId !== hoverRequestId) return;
		appState.hoverMask = result.masks[result.selectedIndex] ?? null;
		appState.hoverTriggerPos = appState.hoverMask ? { x, y } : null;
	} catch {
		logger.debug('Hover decode failed');
		appState.hoverMask = null;
		appState.hoverTriggerPos = null;
	} finally {
		hoverInferenceRunning = false;
		// Drain: if the cursor moved while we were decoding, run with the latest position
		if (hoverPendingCoords) {
			const { cx: px, cy: py } = hoverPendingCoords;
			hoverPendingCoords = null;
			void runHoverDecode(px, py);
		}
	}
}

function handleMouseUp(_event: MouseEvent) {
	if (isDragging && appState.box && !appState.isModelReady) {
		logger.warn('Box drag complete but model not ready, decode skipped');
	}
	if (isDragging && appState.box && appState.isModelReady) {
		scheduleSave();
		// Snapshot the reactive box proxy so it's structured-cloneable for the worker
		void runDecoder([], $state.snapshot(appState.box));
	}
	isDragging = false;
	dragStart = null;
}

function handleDrop(event: DragEvent) {
	event.preventDefault();
	isDropHover = false;
	void handleFileDrop(event.dataTransfer?.files ?? null);
}

function handleDragOver(event: DragEvent) {
	event.preventDefault();
	isDropHover = true;
}

function handleDragLeave() {
	isDropHover = false;
}

function handleFileInput(event: Event) {
	const input = event.target as HTMLInputElement;
	void handleFileDrop(input.files);
}

const container = css({
	position: 'relative',
	flex: '1',
	minH: '0',
	bg: 'bg.muted',
	borderRadius: 'lg',
	overflow: 'hidden',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
});

const panzoomWrapper = css({
	position: 'absolute',
	inset: '0',
	w: 'full',
	h: 'full',
	transformOrigin: '50% 50%',
});

const canvasStyle = css({
	display: 'block',
	w: 'full',
	h: 'full',
});

const zoomControls = css({
	position: 'absolute',
	bottom: '3',
	right: '3',
	display: 'flex',
	gap: '1',
	zIndex: 10,
});

const zoomBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	w: '8',
	h: '8',
	borderRadius: 'md',
	bg: 'bg',
	color: 'fg.muted',
	border: '1px solid',
	borderColor: 'border',
	cursor: 'pointer',
	transition: 'all 150ms',
	_hover: {
		bg: 'bg.subtle',
		color: 'fg',
	},
});

const dropZone = css({
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '3',
	p: '8',
	borderWidth: '2px',
	borderStyle: 'dashed',
	borderColor: 'border',
	borderRadius: 'xl',
	cursor: 'pointer',
	transition: 'all 200ms',
	color: 'fg.muted',
	_hover: { borderColor: 'primary', color: 'primary' },
});

const dropZoneActive = css({
	borderColor: 'primary',
	bg: 'primary.subtle',
	color: 'primary',
});

const dropLabel = css({
	fontSize: 'md',
	fontWeight: 'medium',
});

const dropSub = css({
	fontSize: 'sm',
	color: 'fg.subtle',
});

const cursorPoint = css({
	cursor: 'crosshair',
});

const cursorBox = css({
	cursor: 'crosshair',
});
</script>

<div
	class={container}
	bind:this={containerEl}
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	role="application"
	aria-label="Image canvas"
>
	{#if appState.currentImage}
		<div bind:this={panzoomEl} class={panzoomWrapper}>
			<canvas
				bind:this={canvasEl}
				class={cx(canvasStyle, appState.interactionMode === 'point' ? cursorPoint : appState.interactionMode === 'box' ? cursorBox : '')}
				onclick={handleCanvasClick}
				oncontextmenu={handleContextMenu}
				onmousedown={handleMouseDown}
				onmousemove={handleMouseMove}
				onmouseup={handleMouseUp}
			></canvas>
		</div>
		<div class={zoomControls}>
			<button
				type="button"
				class={zoomBtn}
				onclick={() => panzoomInstance?.zoomIn()}
				aria-label="Zoom in"
			>
				<ZoomIn size={16} />
			</button>
			<button
				type="button"
				class={zoomBtn}
				onclick={() => panzoomInstance?.zoomOut()}
				aria-label="Zoom out"
			>
				<ZoomOut size={16} />
			</button>
			<button
				type="button"
				class={zoomBtn}
				onclick={() => panzoomInstance?.reset()}
				aria-label="Reset zoom"
			>
				<RotateCcw size={16} />
			</button>
		</div>
	{:else}
		<label class={`${dropZone} ${isDropHover ? dropZoneActive : ''}`}>
			{#if isDropHover}
				<Upload size={48} />
				<span class={dropLabel}>Drop image here</span>
			{:else}
				<ImageIcon size={48} />
				<span class={dropLabel}>Drop an image or click to browse</span>
				<span class={dropSub}>Supports PNG, JPG, WebP</span>
			{/if}
			<input
				type="file"
				accept="image/*"
				onchange={handleFileInput}
				class={css({ position: 'absolute', opacity: 0, w: 0, h: 0 })}
			/>
		</label>
	{/if}
</div>
