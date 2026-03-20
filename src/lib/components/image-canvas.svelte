<script lang="ts">
import { appState, resetPrompts, pushPromptState } from '$lib/stores/app-state.svelte';
import { loadImageFromFile, computeFit, canvasToImageCoords } from '$lib/utils/image';
import { scheduleSave, persistImage } from '$lib/stores/persistence.svelte';
import {
	drawPointMarker,
	drawBoxOutline,
	drawCrosshair,
	drawHoverTriggerMarker,
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
} from '$lib/stores/inference-pipeline.svelte';
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
let hoverDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

	const imgLayer = renderImageLayer(img, canvasWidth, canvasHeight, fit);
	ctx.drawImage(imgLayer, 0, 0);

	if (appState.everythingMasks.length > 0) {
		for (const segment of appState.everythingMasks) {
			drawMaskOverlay(ctx, segment.mask, segment.color, 0.4, scale, offsetX, offsetY);
		}
	}

	if (mask && appState.maskViewMode === 'cutout') {
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

function handleCanvasClick(event: MouseEvent) {
	cancelHoverDecode();
	if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);

	if (!appState.currentImage) return;
	if (!getIsModelReady()) {
		logger.warn(`Click ignored: pipeline is '${getPipelinePhase()}'`);
		return;
	}

	// Everything mode: click to select a segment
	if (appState.interactionMode === 'everything' && appState.everythingMasks.length > 0 && canvasEl) {
		const { x: cx, y: cy } = screenToCanvasCoords(event.clientX, event.clientY);
		const { x, y } = canvasToImageCoords(cx, cy, fit.scale, fit.offsetX, fit.offsetY);
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
	if (!canvasEl) return;

	const { x: cx, y: cy } = screenToCanvasCoords(event.clientX, event.clientY);
	const { x, y } = canvasToImageCoords(cx, cy, fit.scale, fit.offsetX, fit.offsetY);

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

	// Debounced hover decode — coordinate transform happens here, pipeline gets image-space coords
	if (
		appState.hoverPreviewEnabled &&
		appState.interactionMode === 'point' &&
		appState.currentImage &&
		getCanHoverDecode() &&
		!isDragging
	) {
		if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);
		hoverDebounceTimer = setTimeout(() => {
			const { x, y } = canvasToImageCoords(mousePos.x, mousePos.y, fit.scale, fit.offsetX, fit.offsetY);
			scheduleHoverDecode(x, y);
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
