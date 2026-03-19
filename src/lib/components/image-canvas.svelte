<script lang="ts">
import { appState, resetPrompts } from '$lib/stores/app-state.svelte';
import { loadImageFromFile, computeFit, canvasToImageCoords } from '$lib/utils/image';
import { drawPointMarker, drawBoxOutline, drawMaskOverlay, drawMaskOutline, drawCrosshair } from '$lib/utils/canvas';
import { decodeMask } from '$lib/inference/decoder';
import { encodeImage } from '$lib/inference/encoder';
import { getSession } from '$lib/inference/session';
import type { Point, Box } from '$lib/inference/types';
import type { ImageEmbedding } from '$lib/inference/encoder';
import Upload from '@lucide/svelte/icons/upload';
import ImageIcon from '@lucide/svelte/icons/image';
import { css } from 'styled-system/css';

let canvasEl: HTMLCanvasElement | undefined = $state();
let containerEl: HTMLDivElement | undefined = $state();
let isDragging = $state(false);
let dragStart: { x: number; y: number } | null = $state(null);
let mousePos = $state({ x: 0, y: 0 });
let isDropHover = $state(false);
let embedding: ImageEmbedding | null = $state(null);

const canvasWidth = $derived(containerEl?.clientWidth ?? 800);
const canvasHeight = $derived(containerEl?.clientHeight ?? 600);

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
		embedding = null;

		if (appState.isModelReady) {
			await runEncoder();
		}
	} catch {
		appState.currentImage = null;
	}
}

async function runEncoder() {
	const session = getSession();
	if (!session || !appState.currentImage) return;

	appState.inferenceProgress = { stage: 'encoding' };
	const start = performance.now();
	try {
		embedding = await encodeImage(session, appState.currentImage);
		appState.inferenceProgress = { stage: 'idle' };
	} catch (err) {
		appState.inferenceProgress = {
			stage: 'error',
			error: err instanceof Error ? err.message : 'Encoding failed',
		};
	}
}

async function runDecoder(points: Point[], box: Box | null) {
	const session = getSession();
	if (!session || !embedding || !appState.currentImage) return;

	appState.inferenceProgress = { stage: 'decoding' };
	const start = performance.now();

	try {
		const result = await decodeMask(
			session,
			embedding,
			{ points: points.length > 0 ? points : undefined, box: box ?? undefined },
			appState.currentImage.naturalWidth,
			appState.currentImage.naturalHeight,
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

	const rect = canvasEl?.getBoundingClientRect();
	if (!rect) return;

	const cx = event.clientX - rect.left;
	const cy = event.clientY - rect.top;
	const { x, y } = canvasToImageCoords(cx, cy, fit.scale, fit.offsetX, fit.offsetY);

	if (x < 0 || y < 0 || x > appState.currentImage.naturalWidth || y > appState.currentImage.naturalHeight) return;

	if (appState.interactionMode === 'point') {
		const label: 1 | 0 = event.shiftKey ? 0 : 1;
		const newPoints = [...appState.points, { x, y, label }];
		appState.points = newPoints;
		void runDecoder(newPoints, null);
	}
}

function handleMouseDown(event: MouseEvent) {
	if (appState.interactionMode !== 'box' || !appState.currentImage) return;

	const rect = canvasEl?.getBoundingClientRect();
	if (!rect) return;

	const cx = event.clientX - rect.left;
	const cy = event.clientY - rect.top;
	const { x, y } = canvasToImageCoords(cx, cy, fit.scale, fit.offsetX, fit.offsetY);

	isDragging = true;
	dragStart = { x, y };
	appState.box = { x1: x, y1: y, x2: x, y2: y };
}

function handleMouseMove(event: MouseEvent) {
	const rect = canvasEl?.getBoundingClientRect();
	if (!rect) return;

	mousePos = { x: event.clientX - rect.left, y: event.clientY - rect.top };

	if (isDragging && dragStart && appState.interactionMode === 'box') {
		const { x, y } = canvasToImageCoords(mousePos.x, mousePos.y, fit.scale, fit.offsetX, fit.offsetY);
		appState.box = { x1: dragStart.x, y1: dragStart.y, x2: x, y2: y };
	}
}

function handleMouseUp(_event: MouseEvent) {
	if (isDragging && appState.box && appState.isModelReady) {
		void runDecoder([], appState.box);
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
	position: 'absolute',
	inset: '0',
	w: 'full',
	h: 'full',
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
		<canvas
			bind:this={canvasEl}
			class={`${canvasStyle} ${appState.interactionMode === 'point' ? cursorPoint : appState.interactionMode === 'box' ? cursorBox : ''}`}
			onclick={handleCanvasClick}
			onmousedown={handleMouseDown}
			onmousemove={handleMouseMove}
			onmouseup={handleMouseUp}
		></canvas>
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
