<script lang="ts">
import { appState, resetPrompts, clearEmbedding } from '$lib/stores/app-state.svelte';
import { loadImageFromFile, computeFit, canvasToImageCoords, imageToRawData } from '$lib/utils/image';
import { drawPointMarker, drawBoxOutline, drawMaskOverlay, drawMaskOutline, drawCrosshair } from '$lib/utils/canvas';
import { getWorkerApi } from '$lib/inference/worker-api';
import type { Point, Box } from '$lib/inference/types';
import type { PanzoomObject } from '@panzoom/panzoom';
import Upload from '@lucide/svelte/icons/upload';
import ImageIcon from '@lucide/svelte/icons/image';
import ZoomIn from '@lucide/svelte/icons/zoom-in';
import ZoomOut from '@lucide/svelte/icons/zoom-out';
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import { css, cx } from 'styled-system/css';

let canvasEl: HTMLCanvasElement | undefined = $state();
let containerEl: HTMLDivElement | undefined = $state();
let panzoomEl: HTMLDivElement | undefined = $state();
let panzoomInstance: PanzoomObject | undefined = $state();
let isDragging = $state(false);
let dragStart: { x: number; y: number } | null = $state(null);
let mousePos = $state({ x: 0, y: 0 });
let isDropHover = $state(false);

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
	import('@panzoom/panzoom').then(({ default: Panzoom }) => {
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

	if (appState.maskViewMode === 'cutout' && appState.maskResult) {
		const mask = appState.maskResult.masks[appState.maskResult.selectedIndex];
		if (mask) {
			const offscreen = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
			const offCtx = offscreen.getContext('2d');
			if (offCtx) {
				offCtx.drawImage(img, 0, 0);
				const imageData = offCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
				for (let i = 0; i < imageData.data.length; i += 4) {
					imageData.data[i + 3] = mask.data[i + 3]!;
				}
				offCtx.putImageData(imageData, 0, 0);
				ctx.drawImage(offscreen, offsetX, offsetY, img.naturalWidth * scale, img.naturalHeight * scale);
			}
		}
	} else {
		ctx.drawImage(img, offsetX, offsetY, img.naturalWidth * scale, img.naturalHeight * scale);

		if (appState.maskResult) {
			const mask = appState.maskResult.masks[appState.maskResult.selectedIndex];
			if (mask) {
				if (appState.maskViewMode === 'overlay') {
					drawMaskOverlay(ctx, mask, appState.maskColor, appState.maskOpacity, scale, offsetX, offsetY);
				} else if (appState.maskViewMode === 'outline') {
					drawMaskOutline(ctx, mask, appState.maskColor, scale, offsetX, offsetY);
				}
			}
		}
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

async function handleFileDrop(files: FileList | null) {
	if (!files || files.length === 0) return;
	const file = files[0];
	if (!file?.type.startsWith('image/')) return;

	appState.imageFile = file;
	try {
		appState.currentImage = await loadImageFromFile(file);
		resetPrompts();
		clearEmbedding();

		if (appState.isModelReady) {
			await runEncoder();
		}
	} catch {
		appState.currentImage = null;
	}
}

async function runEncoder() {
	if (!appState.currentImage) return;

	const api = getWorkerApi();
	appState.inferenceProgress = { stage: 'encoding' };
	const start = performance.now();
	try {
		const rawData = imageToRawData(appState.currentImage);
		appState.embedding = await api.encode(rawData);
		const elapsed = Math.round(performance.now() - start);
		appState.inferenceProgress = { stage: 'complete', timeMs: elapsed };
	} catch (err) {
		appState.inferenceProgress = {
			stage: 'error',
			error: err instanceof Error ? err.message : 'Encoding failed',
		};
	}
}

async function runDecoder(points: Point[], box: Box | null) {
	if (!appState.embedding || !appState.currentImage) return;

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

		const result = await api.decode(
			{
				points: points.length > 0 ? $state.snapshot(points) : undefined,
				box: box ? $state.snapshot(box) : undefined,
			},
			{
				maskInput,
				outputWidth: appState.currentImage.naturalWidth,
				outputHeight: appState.currentImage.naturalHeight,
			},
		);
		const elapsed = Math.round(performance.now() - start);
		appState.maskResult = result;
		appState.inferenceProgress = { stage: 'complete', timeMs: elapsed };
	} catch (err) {
		appState.inferenceProgress = {
			stage: 'error',
			error: err instanceof Error ? err.message : 'Decoding failed',
		};
	}
}

function handleCanvasClick(event: MouseEvent) {
	if (!appState.currentImage || !appState.isModelReady) return;
	if (appState.interactionMode !== 'point') return;
	if (!canvasEl) return;

	const { x: cx, y: cy } = screenToCanvasCoords(event.clientX, event.clientY);
	const { x, y } = canvasToImageCoords(cx, cy, fit.scale, fit.offsetX, fit.offsetY);

	if (x < 0 || y < 0 || x >= appState.currentImage.naturalWidth || y >= appState.currentImage.naturalHeight) return;

	// Right-click or shift+click = negative (label 0), left-click = positive (label 1)
	const label: 0 | 1 = event.button === 2 || event.shiftKey ? 0 : 1;
	const newPoints = [...appState.points, { x, y, label }];
	appState.points = newPoints;
	void runDecoder(newPoints, null);
}

function handleContextMenu(event: MouseEvent) {
	if (!appState.currentImage || !appState.isModelReady) return;
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
}

function handleMouseUp(_event: MouseEvent) {
	if (isDragging && appState.box && appState.isModelReady) {
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
