<script lang="ts">
import { appState, resetPrompts, pushPromptState } from '$lib/stores/app-state.svelte';
import { loadImageFromFile, computeFit } from '$lib/utils/image';
import { scheduleSave, persistImage } from '$lib/stores/persistence.svelte';
import {
	drawPointMarker,
	drawBoxOutline,
	drawCrosshair,
	drawHoverTriggerMarker,
	drawHoverInferenceRing,
	drawMaskOverlay,
	renderImageLayer,
	renderMaskLayer,
	renderHoverDeltaLayer,
	invalidateAllLayers,
} from '$lib/utils/canvas';
import {
	getIsModelReady,
	getCanHoverDecode,
	getPipelinePhase,
	encodeCurrentImage,
	decodePrompts,
	clearEmbedding,
	scheduleHoverDecode,
	cancelHoverDecode,
	getHoverDebounceFloor,
	getHoverInferenceRunning,
} from '$lib/stores/inference-pipeline.svelte';
import {
	type Viewport,
	computeTransform,
	screenToImageCoords,
	zoomAtPoint,
	resetViewport,
	effectiveScale,
} from '$lib/utils/viewport';
import Upload from '@lucide/svelte/icons/upload';
import ImageIcon from '@lucide/svelte/icons/image';
import ZoomIn from '@lucide/svelte/icons/zoom-in';
import ZoomOut from '@lucide/svelte/icons/zoom-out';
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import { getLogger } from '@logtape/logtape';
import DemoStrip from '$lib/components/demo-strip.svelte';
import { css, cx } from 'styled-system/css';

interface Props {
	onOpenGallery?: () => void;
}

const { onOpenGallery }: Props = $props();

const logger = getLogger(['websam', 'ui', 'canvas']);

let canvasEl: HTMLCanvasElement | undefined = $state();
let containerEl: HTMLDivElement | undefined = $state();
let isDragging = $state(false);
let dragStart: { x: number; y: number } | null = $state(null);
let isDropHover = $state(false);
let hoverDebounceTimer: ReturnType<typeof setTimeout> | null = null;

let canvasWidth = $state(800);
let canvasHeight = $state(600);

let dpr = $state(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1);
let viewport = $state<Viewport>({ x: 0, y: 0, scale: 1 });
let mouseImagePos = $state({ x: 0, y: 0 });
let mouseCssPos = $state({ x: 0, y: 0 });
let isPanning = $state(false);
let panStart = $state({ x: 0, y: 0 });

// DPR change listener
$effect(() => {
	const mql = matchMedia(`(resolution: ${dpr}dppx)`);
	function onChange() { dpr = window.devicePixelRatio || 1; }
	mql.addEventListener('change', onChange);
	return () => mql.removeEventListener('change', onChange);
});

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

// Wheel event with passive: false
$effect(() => {
	if (!containerEl) return;
	const el = containerEl;
	el.addEventListener('wheel', handleWheel, { passive: false });
	return () => el.removeEventListener('wheel', handleWheel);
});

const fit = $derived(
	appState.currentImage
		? computeFit(appState.currentImage.naturalWidth, appState.currentImage.naturalHeight, canvasWidth, canvasHeight)
		: { scale: 1, offsetX: 0, offsetY: 0 },
);

// --- RAF-batched render loop ---

let dirty = false;
let rafId: number | null = null;

function markDirty() {
	if (!dirty) {
		dirty = true;
		rafId = requestAnimationFrame(render);
	}
}

// Tracking effect — reads all reactive deps, calls markDirty
$effect(() => {
	void canvasEl;
	void canvasWidth; void canvasHeight; void dpr; void viewport;
	void appState.currentImage; void appState.maskResult;
	void appState.maskViewMode; void appState.maskColor; void appState.maskOpacity;
	void appState.hoverMask; void appState.hoverTriggerPos;
	void appState.points; void appState.box;
	void appState.interactionMode; void appState.everythingMasks;
	void mouseImagePos; void mouseCssPos; void fit;
	void appState.hoverPreviewEnabled;
	void getHoverInferenceRunning();
	markDirty();
});

// Continuous rAF loop while hover inference is running (for pulse animation)
$effect(() => {
	if (!getHoverInferenceRunning()) return;
	let animId: number;
	function tick() {
		markDirty();
		animId = requestAnimationFrame(tick);
	}
	animId = requestAnimationFrame(tick);
	return () => cancelAnimationFrame(animId);
});

// Cleanup RAF on unmount
$effect(() => {
	return () => { if (rafId !== null) cancelAnimationFrame(rafId); };
});

function render() {
	dirty = false;
	rafId = null;
	if (!canvasEl) return;
	const ctx = canvasEl.getContext('2d');
	if (!ctx) return;

	// Size canvas buffer for DPR
	const bufferW = Math.floor(canvasWidth * dpr);
	const bufferH = Math.floor(canvasHeight * dpr);
	canvasEl.width = bufferW;
	canvasEl.height = bufferH;

	// Clear in buffer space
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, bufferW, bufferH);

	if (!appState.currentImage) return;

	const img = appState.currentImage;
	const mask = appState.maskResult?.masks[appState.maskResult.selectedIndex] ?? null;
	const effScale = effectiveScale(fit, viewport);

	// Apply image-space transform
	const t = computeTransform(fit, viewport, dpr);
	ctx.setTransform(t.a, 0, 0, t.a, t.tx, t.ty);

	// Draw image layer (cutout mode skips this)
	if (!(mask && appState.maskViewMode === 'cutout')) {
		const imgLayer = renderImageLayer(img);
		ctx.drawImage(imgLayer, 0, 0);
	}

	// Everything mode masks
	if (appState.everythingMasks.length > 0) {
		for (const segment of appState.everythingMasks) {
			drawMaskOverlay(ctx, segment.mask, segment.color, 0.4);
		}
	}

	// Primary mask
	if (mask && appState.maskViewMode === 'cutout') {
		const cutoutLayer = renderMaskLayer(mask, appState.maskColor, appState.maskOpacity, 'cutout', img);
		if (cutoutLayer) {
			ctx.drawImage(cutoutLayer, 0, 0);
		}
	} else if (mask) {
		const maskLayer = renderMaskLayer(
			mask, appState.maskColor, appState.maskOpacity, appState.maskViewMode, null
		);
		if (maskLayer) ctx.drawImage(maskLayer, 0, 0);
	}

	// Hover delta
	if (appState.hoverMask && appState.interactionMode === 'point') {
		const hoverLayer = renderHoverDeltaLayer(appState.hoverMask, mask);
		if (hoverLayer) ctx.drawImage(hoverLayer, 0, 0);
	}

	// Hover trigger marker (image space)
	if (appState.hoverMask && appState.hoverTriggerPos && appState.interactionMode === 'point') {
		drawHoverTriggerMarker(
			ctx,
			appState.hoverTriggerPos.x,
			appState.hoverTriggerPos.y,
			mouseImagePos.x,
			mouseImagePos.y,
			effScale,
		);
	}

	// Point markers (image space)
	for (const point of appState.points) {
		drawPointMarker(ctx, point, effScale);
	}

	// Box outline (image space)
	if (appState.box) {
		drawBoxOutline(ctx, appState.box, effScale);
	}

	// Crosshair (screen space -- drawCrosshair resets transform internally)
	if (appState.interactionMode === 'point' && appState.currentImage) {
		drawCrosshair(ctx, mouseCssPos.x, mouseCssPos.y, dpr);
	}

	// Hover inference ring (image space — pulsing circle while decode is in-flight)
	if (getHoverInferenceRunning() && appState.interactionMode === 'point') {
		drawHoverInferenceRing(ctx, mouseImagePos.x, mouseImagePos.y, effScale);
	}
}

$effect(() => {
	function onLoadFile(e: Event) {
		const file = (e as CustomEvent<File>).detail;
		if (!file) return;
		const dt = new DataTransfer();
		dt.items.add(file);
		void handleFileDrop(dt.files);
	}
	window.addEventListener('websam:load-file', onLoadFile);
	return () => window.removeEventListener('websam:load-file', onLoadFile);
});

// Clear hover state and layer caches when interaction mode or image changes
$effect(() => {
	void appState.interactionMode;
	void appState.currentImage;
	cancelHoverDecode();
	invalidateAllLayers();
	if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);
	return () => {
		if (hoverDebounceTimer) {
			clearTimeout(hoverDebounceTimer);
			hoverDebounceTimer = null;
		}
	};
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
		viewport = resetViewport();
		await persistImage(file);
		scheduleSave();
		logger.info('Image loaded', {
			fileName: file.name,
			width: appState.currentImage?.naturalWidth,
			height: appState.currentImage?.naturalHeight,
		});

		if (getIsModelReady()) {
			encodeCurrentImage();
		}
	} catch {
		logger.error('Failed to load image', { fileName: file?.name });
		appState.currentImage = null;
	}
}

function handleWheel(event: WheelEvent) {
	event.preventDefault();
	if (!canvasEl) return;
	const rect = canvasEl.getBoundingClientRect();
	const cssX = event.clientX - rect.left;
	const cssY = event.clientY - rect.top;
	const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
	viewport = zoomAtPoint(viewport, cssX, cssY, factor, 0.1, 20);
}

function handlePanStart(event: PointerEvent) {
	if (event.button !== 1) return;
	event.preventDefault();
	isPanning = true;
	panStart = { x: event.clientX - viewport.x, y: event.clientY - viewport.y };
	(event.target as Element).setPointerCapture(event.pointerId);
}

function handlePanMove(event: PointerEvent) {
	if (!isPanning) return;
	viewport = { ...viewport, x: event.clientX - panStart.x, y: event.clientY - panStart.y };
}

function handlePanEnd(_event: PointerEvent) {
	isPanning = false;
}

function handleCanvasClick(event: MouseEvent) {
	if (isPanning) return;
	cancelHoverDecode();
	if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);

	if (!appState.currentImage || !canvasEl) return;
	const phase = getPipelinePhase();
	if (!getIsModelReady()) {
		logger.warn(`Click ignored: pipeline is '${phase}'`);
		return;
	}
	if (phase === 'model-ready' || phase === 'encoding') {
		logger.warn(`Click ignored: image is still encoding (pipeline is '${phase}')`);
		return;
	}

	const rect = canvasEl.getBoundingClientRect();
	const { x, y } = screenToImageCoords(event.clientX, event.clientY, rect, fit, viewport);

	// Everything mode: click to select a segment
	if (appState.interactionMode === 'everything' && appState.everythingMasks.length > 0) {
		const imgX = Math.round(x);
		const imgY = Math.round(y);

		if (imgX < 0 || imgY < 0 || imgX >= appState.currentImage.naturalWidth || imgY >= appState.currentImage.naturalHeight) return;

		for (const segment of appState.everythingMasks) {
			const idx = (imgY * segment.mask.width + imgX) * 4 + 3; // alpha channel
			if (segment.mask.data[idx] > 128) {
				appState.maskResult = {
					masks: [segment.mask],
					rawLogits: new Float32Array(0),
					lowResMasks: new Float32Array(0),
					scores: [segment.score],
					selectedIndex: 0,
				};
				appState.everythingMasks = [];
				appState.interactionMode = 'point';
				logger.info('Everything mode: segment selected');
				return;
			}
		}
		return;
	}

	if (appState.interactionMode !== 'point') return;

	if (x < 0 || y < 0 || x >= appState.currentImage.naturalWidth || y >= appState.currentImage.naturalHeight) return;

	const label: 0 | 1 = event.button === 2 || event.shiftKey ? 0 : 1;
	pushPromptState();
	const newPoints = [...appState.points, { x, y, label }];
	appState.points = newPoints;
	scheduleSave();
	decodePrompts(newPoints, null);
}

function handleContextMenu(event: MouseEvent) {
	if (!appState.currentImage || !getIsModelReady()) return;
	if (appState.interactionMode !== 'point') return;
	event.preventDefault();
	handleCanvasClick(event);
}

function handleMouseDown(event: MouseEvent) {
	if (appState.interactionMode !== 'box' || !appState.currentImage || !canvasEl) return;
	const rect = canvasEl.getBoundingClientRect();
	const { x, y } = screenToImageCoords(event.clientX, event.clientY, rect, fit, viewport);

	pushPromptState();
	isDragging = true;
	dragStart = { x, y };
	appState.box = { x1: x, y1: y, x2: x, y2: y };
}

function handleMouseMove(event: MouseEvent) {
	if (!canvasEl) return;

	const rect = canvasEl.getBoundingClientRect();
	const cssX = event.clientX - rect.left;
	const cssY = event.clientY - rect.top;
	mouseCssPos = { x: cssX, y: cssY };
	mouseImagePos = screenToImageCoords(event.clientX, event.clientY, rect, fit, viewport);

	if (isDragging && dragStart && appState.interactionMode === 'box') {
		appState.box = { x1: dragStart.x, y1: dragStart.y, x2: mouseImagePos.x, y2: mouseImagePos.y };
	}

	// Debounced hover decode
	if (
		appState.hoverPreviewEnabled &&
		appState.interactionMode === 'point' &&
		appState.currentImage &&
		getCanHoverDecode() &&
		!isDragging
	) {
		if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);
		hoverDebounceTimer = setTimeout(() => {
			scheduleHoverDecode(mouseImagePos.x, mouseImagePos.y);
		}, getHoverDebounceFloor());
	}
}

function handleMouseUp(_event: MouseEvent) {
	if (isDragging && appState.box && !getIsModelReady()) {
		logger.warn('Box drag complete but model not ready, decode skipped');
	}
	if (isDragging && appState.box && getIsModelReady()) {
		scheduleSave();
		decodePrompts([], appState.box);
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

const emptyState = css({
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	w: 'full',
	maxW: '32rem',
	gap: '6',
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
		<canvas
			bind:this={canvasEl}
			class={cx(canvasStyle, appState.interactionMode === 'point' ? cursorPoint : appState.interactionMode === 'box' ? cursorBox : '')}
			onclick={handleCanvasClick}
			oncontextmenu={handleContextMenu}
			onmousedown={handleMouseDown}
			onmousemove={handleMouseMove}
			onmouseup={handleMouseUp}
			onpointerdown={handlePanStart}
			onpointermove={handlePanMove}
			onpointerup={handlePanEnd}
		></canvas>
		<div class={zoomControls}>
			<button
				type="button"
				class={zoomBtn}
				onclick={() => { viewport = zoomAtPoint(viewport, canvasWidth / 2, canvasHeight / 2, 1.5, 0.1, 20); }}
				aria-label="Zoom in"
			>
				<ZoomIn size={16} />
			</button>
			<button
				type="button"
				class={zoomBtn}
				onclick={() => { viewport = zoomAtPoint(viewport, canvasWidth / 2, canvasHeight / 2, 1 / 1.5, 0.1, 20); }}
				aria-label="Zoom out"
			>
				<ZoomOut size={16} />
			</button>
			<button
				type="button"
				class={zoomBtn}
				onclick={() => { viewport = resetViewport(); }}
				aria-label="Reset zoom"
			>
				<RotateCcw size={16} />
			</button>
		</div>
	{:else}
		<div class={emptyState}>
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
			<DemoStrip onBrowseAll={() => onOpenGallery?.()} />
		</div>
	{/if}
</div>
