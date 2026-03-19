import type { Point, Box } from '$lib/inference/types';
import { extractContours } from './contour';

export function drawPointMarker(
	ctx: CanvasRenderingContext2D,
	point: Point,
	scale: number,
	offsetX: number,
	offsetY: number,
): void {
	const x = point.x * scale + offsetX;
	const y = point.y * scale + offsetY;
	const radius = 6;

	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fillStyle = point.label === 1 ? 'oklch(0.72 0.19 142)' : 'oklch(0.63 0.24 25)';
	ctx.fill();
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 2;
	ctx.stroke();
}

export function drawBoxOutline(
	ctx: CanvasRenderingContext2D,
	box: Box,
	scale: number,
	offsetX: number,
	offsetY: number,
): void {
	const x = Math.min(box.x1, box.x2) * scale + offsetX;
	const y = Math.min(box.y1, box.y2) * scale + offsetY;
	const w = Math.abs(box.x2 - box.x1) * scale;
	const h = Math.abs(box.y2 - box.y1) * scale;

	ctx.strokeStyle = 'oklch(0.72 0.19 142)';
	ctx.lineWidth = 2;
	ctx.setLineDash([6, 4]);
	ctx.strokeRect(x, y, w, h);
	ctx.setLineDash([]);
}

export function drawMaskOverlay(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	mask: ImageData,
	color: string,
	opacity: number,
	scale: number,
	offsetX: number,
	offsetY: number,
): void {
	const offscreen = new OffscreenCanvas(mask.width, mask.height);
	const offCtx = offscreen.getContext('2d');
	if (!offCtx) return;

	offCtx.putImageData(mask, 0, 0);

	const overlay = new OffscreenCanvas(mask.width, mask.height);
	const overlayCtx = overlay.getContext('2d');
	if (!overlayCtx) return;

	overlayCtx.fillStyle = color;
	overlayCtx.fillRect(0, 0, mask.width, mask.height);
	overlayCtx.globalCompositeOperation = 'destination-in';
	overlayCtx.drawImage(offscreen, 0, 0);

	ctx.globalAlpha = opacity;
	ctx.drawImage(overlay, offsetX, offsetY, mask.width * scale, mask.height * scale);
	ctx.globalAlpha = 1;
}

export function drawMaskOutline(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	mask: ImageData,
	color: string,
	scale: number,
	offsetX: number,
	offsetY: number,
	contours?: [number, number][][],
): void {
	const resolvedContours = contours ?? extractContours(mask);

	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.lineJoin = 'round';

	for (const polygon of resolvedContours) {
		if (polygon.length < 2) continue;
		ctx.beginPath();
		// marching-squares returns [col, row] pairs
		ctx.moveTo(polygon[0][0] * scale + offsetX, polygon[0][1] * scale + offsetY);
		for (let i = 1; i < polygon.length; i++) {
			ctx.lineTo(polygon[i][0] * scale + offsetX, polygon[i][1] * scale + offsetY);
		}
		ctx.closePath();
		ctx.stroke();
	}
}

export function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number): void {
	const size = 10;
	ctx.strokeStyle = 'oklch(1 0 0 / 80%)';
	ctx.lineWidth = 1;

	ctx.beginPath();
	ctx.moveTo(x - size, y);
	ctx.lineTo(x + size, y);
	ctx.moveTo(x, y - size);
	ctx.lineTo(x, y + size);
	ctx.stroke();
}

// ---------------------------------------------------------------------------
// Layer caching — reused across frames to avoid allocation churn
// ---------------------------------------------------------------------------

let imageLayerCanvas: OffscreenCanvas | null = null;
let maskLayerCanvas: OffscreenCanvas | null = null;
let hoverLayerCanvas: OffscreenCanvas | null = null;

// Cache keys for image layer
let cachedImageRef: HTMLImageElement | null = null;
let cachedImageCanvasW = -1;
let cachedImageCanvasH = -1;
let cachedImageFitScale = -1;
let cachedImageFitOffX = -1;
let cachedImageFitOffY = -1;

// Cache keys for mask layer
let cachedMaskRef: ImageData | null = null;
let cachedMaskColor = '';
let cachedMaskOpacity = -1;
let cachedMaskViewMode = '';
let cachedMaskSelectedIndex = -1;
let cachedMaskCanvasW = -1;
let cachedMaskCanvasH = -1;
let cachedMaskFitScale = -1;
let cachedMaskFitOffX = -1;
let cachedMaskFitOffY = -1;
// Cutout mode also depends on the image
let cachedMaskImageRef: HTMLImageElement | null = null;

// Cache for contour extraction (expensive — only recompute when mask changes)
let cachedContours: [number, number][][] | null = null;
let cachedContourMaskRef: ImageData | null = null;

// Cache keys for hover layer
let cachedHoverMaskRef: ImageData | null = null;
let cachedCommittedMaskRef: ImageData | null = null;
let cachedHoverCanvasW = -1;
let cachedHoverCanvasH = -1;
let cachedHoverFitScale = -1;
let cachedHoverFitOffX = -1;
let cachedHoverFitOffY = -1;

/** Ensure an OffscreenCanvas matches the requested dimensions, creating or resizing as needed. */
function ensureCanvas(canvas: OffscreenCanvas | null, w: number, h: number): OffscreenCanvas {
	if (canvas?.width === w && canvas.height === h) return canvas;
	if (canvas) {
		canvas.width = w;
		canvas.height = h;
		return canvas;
	}
	return new OffscreenCanvas(w, h);
}

export function renderImageLayer(
	img: HTMLImageElement,
	canvasW: number,
	canvasH: number,
	fit: { scale: number; offsetX: number; offsetY: number },
): OffscreenCanvas {
	if (
		imageLayerCanvas &&
		cachedImageRef === img &&
		cachedImageCanvasW === canvasW &&
		cachedImageCanvasH === canvasH &&
		cachedImageFitScale === fit.scale &&
		cachedImageFitOffX === fit.offsetX &&
		cachedImageFitOffY === fit.offsetY
	) {
		return imageLayerCanvas;
	}

	imageLayerCanvas = ensureCanvas(imageLayerCanvas, canvasW, canvasH);
	const ctx = imageLayerCanvas.getContext('2d');
	if (!ctx) return imageLayerCanvas;

	ctx.clearRect(0, 0, canvasW, canvasH);
	ctx.drawImage(img, fit.offsetX, fit.offsetY, img.naturalWidth * fit.scale, img.naturalHeight * fit.scale);

	cachedImageRef = img;
	cachedImageCanvasW = canvasW;
	cachedImageCanvasH = canvasH;
	cachedImageFitScale = fit.scale;
	cachedImageFitOffX = fit.offsetX;
	cachedImageFitOffY = fit.offsetY;

	return imageLayerCanvas;
}

export function renderMaskLayer(
	mask: ImageData,
	color: string,
	opacity: number,
	viewMode: string,
	scale: number,
	offsetX: number,
	offsetY: number,
	img: HTMLImageElement | null,
	canvasW: number,
	canvasH: number,
): OffscreenCanvas | null {
	if (
		maskLayerCanvas &&
		cachedMaskRef === mask &&
		cachedMaskColor === color &&
		cachedMaskOpacity === opacity &&
		cachedMaskViewMode === viewMode &&
		cachedMaskCanvasW === canvasW &&
		cachedMaskCanvasH === canvasH &&
		cachedMaskFitScale === scale &&
		cachedMaskFitOffX === offsetX &&
		cachedMaskFitOffY === offsetY &&
		(viewMode !== 'cutout' || cachedMaskImageRef === img)
	) {
		return maskLayerCanvas;
	}

	maskLayerCanvas = ensureCanvas(maskLayerCanvas, canvasW, canvasH);
	const ctx = maskLayerCanvas.getContext('2d');
	if (!ctx) return null;

	ctx.clearRect(0, 0, canvasW, canvasH);

	if (viewMode === 'overlay') {
		drawMaskOverlay(ctx, mask, color, opacity, scale, offsetX, offsetY);
	} else if (viewMode === 'outline') {
		// Reuse cached contours if the mask reference hasn't changed
		if (cachedContourMaskRef !== mask) {
			cachedContours = extractContours(mask);
			cachedContourMaskRef = mask;
		}
		drawMaskOutline(ctx, mask, color, scale, offsetX, offsetY, cachedContours!);
	} else if (viewMode === 'cutout' && img) {
		// Draw image masked by the mask alpha
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

	cachedMaskRef = mask;
	cachedMaskColor = color;
	cachedMaskOpacity = opacity;
	cachedMaskViewMode = viewMode;
	cachedMaskCanvasW = canvasW;
	cachedMaskCanvasH = canvasH;
	cachedMaskFitScale = scale;
	cachedMaskFitOffX = offsetX;
	cachedMaskFitOffY = offsetY;
	cachedMaskImageRef = img;

	return maskLayerCanvas;
}

export function renderHoverDeltaLayer(
	hoverMask: ImageData,
	committedMask: ImageData | null,
	scale: number,
	offsetX: number,
	offsetY: number,
	canvasW: number,
	canvasH: number,
): OffscreenCanvas | null {
	if (
		hoverLayerCanvas &&
		cachedHoverMaskRef === hoverMask &&
		cachedCommittedMaskRef === committedMask &&
		cachedHoverCanvasW === canvasW &&
		cachedHoverCanvasH === canvasH &&
		cachedHoverFitScale === scale &&
		cachedHoverFitOffX === offsetX &&
		cachedHoverFitOffY === offsetY
	) {
		return hoverLayerCanvas;
	}

	hoverLayerCanvas = ensureCanvas(hoverLayerCanvas, canvasW, canvasH);
	const ctx = hoverLayerCanvas.getContext('2d');
	if (!ctx) return null;

	ctx.clearRect(0, 0, canvasW, canvasH);

	if (!committedMask) {
		// No committed mask — show the full hover mask with green tint at 30% opacity
		drawMaskOverlay(ctx, hoverMask, '#22c55e', 0.3, scale, offsetX, offsetY);
	} else {
		// Committed mask exists — compute additions-only delta
		const w = hoverMask.width;
		const h = hoverMask.height;
		const deltaData = new ImageData(w, h);

		let hasAdditions = false;
		for (let i = 0; i < w * h; i++) {
			const pi = i * 4;
			const hoverAlpha = hoverMask.data[pi + 3];
			const committedAlpha = committedMask.data[pi + 3];
			if (hoverAlpha > 128 && committedAlpha <= 128) {
				// Addition pixel — green (#22c55e)
				deltaData.data[pi] = 0x22;
				deltaData.data[pi + 1] = 0xc5;
				deltaData.data[pi + 2] = 0x5e;
				deltaData.data[pi + 3] = 77; // ~30% of 255
				hasAdditions = true;
			}
		}

		if (!hasAdditions) {
			// Update cache keys even when no additions so we don't recompute
			cachedHoverMaskRef = hoverMask;
			cachedCommittedMaskRef = committedMask;
			cachedHoverCanvasW = canvasW;
			cachedHoverCanvasH = canvasH;
			cachedHoverFitScale = scale;
			cachedHoverFitOffX = offsetX;
			cachedHoverFitOffY = offsetY;
			return null;
		}

		const deltaCanvas = new OffscreenCanvas(w, h);
		const deltaCtx = deltaCanvas.getContext('2d');
		if (deltaCtx) {
			deltaCtx.putImageData(deltaData, 0, 0);
			ctx.drawImage(deltaCanvas, offsetX, offsetY, w * scale, h * scale);
		}
	}

	cachedHoverMaskRef = hoverMask;
	cachedCommittedMaskRef = committedMask;
	cachedHoverCanvasW = canvasW;
	cachedHoverCanvasH = canvasH;
	cachedHoverFitScale = scale;
	cachedHoverFitOffX = offsetX;
	cachedHoverFitOffY = offsetY;

	return hoverLayerCanvas;
}

/** Clear all layer caches (call on image change). */
export function invalidateAllLayers(): void {
	imageLayerCanvas = null;
	maskLayerCanvas = null;
	hoverLayerCanvas = null;

	cachedImageRef = null;
	cachedImageCanvasW = -1;
	cachedImageCanvasH = -1;
	cachedImageFitScale = -1;
	cachedImageFitOffX = -1;
	cachedImageFitOffY = -1;

	cachedMaskRef = null;
	cachedMaskColor = '';
	cachedMaskOpacity = -1;
	cachedMaskViewMode = '';
	cachedMaskSelectedIndex = -1;
	cachedMaskCanvasW = -1;
	cachedMaskCanvasH = -1;
	cachedMaskFitScale = -1;
	cachedMaskFitOffX = -1;
	cachedMaskFitOffY = -1;
	cachedMaskImageRef = null;

	cachedContours = null;
	cachedContourMaskRef = null;

	cachedHoverMaskRef = null;
	cachedCommittedMaskRef = null;
	cachedHoverCanvasW = -1;
	cachedHoverCanvasH = -1;
	cachedHoverFitScale = -1;
	cachedHoverFitOffX = -1;
	cachedHoverFitOffY = -1;
}
