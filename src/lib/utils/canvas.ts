import type { Point, Box } from '$lib/inference/types';
import { extractContours } from './contour';

export function drawPointMarker(
	ctx: CanvasRenderingContext2D,
	point: Point,
	effScale: number,
): void {
	const radius = 6 / effScale;

	ctx.beginPath();
	ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
	ctx.fillStyle = point.label === 1 ? 'oklch(0.72 0.19 142)' : 'oklch(0.63 0.24 25)';
	ctx.fill();
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 2 / effScale;
	ctx.stroke();
}

export function drawBoxOutline(
	ctx: CanvasRenderingContext2D,
	box: Box,
	effScale: number,
): void {
	const x = Math.min(box.x1, box.x2);
	const y = Math.min(box.y1, box.y2);
	const w = Math.abs(box.x2 - box.x1);
	const h = Math.abs(box.y2 - box.y1);

	ctx.strokeStyle = 'oklch(0.72 0.19 142)';
	ctx.lineWidth = 2 / effScale;
	ctx.setLineDash([6 / effScale, 4 / effScale]);
	ctx.strokeRect(x, y, w, h);
	ctx.setLineDash([]);
}

export function drawMaskOverlay(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	mask: ImageData,
	color: string,
	opacity: number,
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
	ctx.drawImage(overlay, 0, 0);
	ctx.globalAlpha = 1;
}

export function drawMaskOutline(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	mask: ImageData,
	color: string,
	effScale: number,
	contours?: [number, number][][],
): void {
	const resolvedContours = contours ?? extractContours(mask);

	ctx.strokeStyle = color;
	ctx.lineWidth = 2 / effScale;
	ctx.lineJoin = 'round';

	for (const polygon of resolvedContours) {
		if (polygon.length < 2) continue;
		ctx.beginPath();
		ctx.moveTo(polygon[0][0], polygon[0][1]);
		for (let i = 1; i < polygon.length; i++) {
			ctx.lineTo(polygon[i][0], polygon[i][1]);
		}
		ctx.closePath();
		ctx.stroke();
	}
}

/**
 * Draws a crosshair at the cursor position in screen space.
 * Temporarily resets the transform so the crosshair follows the CSS cursor
 * regardless of the image-space transform applied to the context.
 */
export function drawCrosshair(
	ctx: CanvasRenderingContext2D,
	cssX: number,
	cssY: number,
	dpr: number,
): void {
	const size = 10;

	const saved = ctx.getTransform();
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	ctx.strokeStyle = 'oklch(1 0 0 / 80%)';
	ctx.lineWidth = 1;

	ctx.beginPath();
	ctx.moveTo(cssX - size, cssY);
	ctx.lineTo(cssX + size, cssY);
	ctx.moveTo(cssX, cssY - size);
	ctx.lineTo(cssX, cssY + size);
	ctx.stroke();

	ctx.setTransform(saved);
}

/**
 * Draws a subtle crosshair at the image-space position where the hover decode
 * was triggered, giving the user visual context for the displayed hover mask.
 * Only drawn when the cursor has drifted away from the trigger point.
 *
 * All coordinates are in image pixel space. The distance threshold is computed
 * in screen pixels using effScale.
 */
export function drawHoverTriggerMarker(
	ctx: CanvasRenderingContext2D,
	triggerX: number,
	triggerY: number,
	cursorX: number,
	cursorY: number,
	effScale: number,
): void {
	// Distance in screen pixels for threshold comparison
	const dist = Math.hypot(
		(triggerX - cursorX) * effScale,
		(triggerY - cursorY) * effScale,
	);
	// Only show when cursor has drifted noticeably from the trigger point
	if (dist < 8) return;
	// Fade in as the cursor drifts further, fully opaque at 40px+
	const alpha = Math.min((dist - 8) / 32, 1);

	const arm = 7 / effScale;
	const gap = 3 / effScale;
	ctx.save();
	ctx.globalAlpha = alpha * 0.6;
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 2 / effScale;
	ctx.beginPath();
	ctx.moveTo(triggerX - arm, triggerY);
	ctx.lineTo(triggerX - gap, triggerY);
	ctx.moveTo(triggerX + gap, triggerY);
	ctx.lineTo(triggerX + arm, triggerY);
	ctx.moveTo(triggerX, triggerY - arm);
	ctx.lineTo(triggerX, triggerY - gap);
	ctx.moveTo(triggerX, triggerY + gap);
	ctx.lineTo(triggerX, triggerY + arm);
	ctx.stroke();
	ctx.strokeStyle = 'oklch(0.75 0.17 155 / 80%)';
	ctx.lineWidth = 1 / effScale;
	ctx.beginPath();
	ctx.moveTo(triggerX - arm, triggerY);
	ctx.lineTo(triggerX - gap, triggerY);
	ctx.moveTo(triggerX + gap, triggerY);
	ctx.lineTo(triggerX + arm, triggerY);
	ctx.moveTo(triggerX, triggerY - arm);
	ctx.lineTo(triggerX, triggerY - gap);
	ctx.moveTo(triggerX, triggerY + gap);
	ctx.lineTo(triggerX, triggerY + arm);
	ctx.stroke();
	ctx.restore();
}

// ---------------------------------------------------------------------------
// Layer caching — reused across frames to avoid allocation churn
// ---------------------------------------------------------------------------

let imageLayerCanvas: OffscreenCanvas | null = null;
let maskLayerCanvas: OffscreenCanvas | null = null;
let hoverLayerCanvas: OffscreenCanvas | null = null;

// Cache keys for image layer
let cachedImageRef: HTMLImageElement | null = null;

// Cache keys for mask layer
let cachedMaskRef: ImageData | null = null;
let cachedMaskColor = '';
let cachedMaskOpacity = -1;
let cachedMaskViewMode = '';
let cachedMaskImageRef: HTMLImageElement | null = null;

// Cache for contour extraction (expensive — only recompute when mask changes)
let cachedContours: [number, number][][] | null = null;
let cachedContourMaskRef: ImageData | null = null;

// Cache keys for hover layer
let cachedHoverMaskRef: ImageData | null = null;
let cachedCommittedMaskRef: ImageData | null = null;

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

export function renderImageLayer(img: HTMLImageElement): OffscreenCanvas {
	if (imageLayerCanvas && cachedImageRef === img) {
		return imageLayerCanvas;
	}

	const w = img.naturalWidth;
	const h = img.naturalHeight;
	imageLayerCanvas = ensureCanvas(imageLayerCanvas, w, h);
	const ctx = imageLayerCanvas.getContext('2d');
	if (!ctx) return imageLayerCanvas;

	ctx.clearRect(0, 0, w, h);
	ctx.drawImage(img, 0, 0);

	cachedImageRef = img;

	return imageLayerCanvas;
}

export function renderMaskLayer(
	mask: ImageData,
	color: string,
	opacity: number,
	viewMode: string,
	img: HTMLImageElement | null,
): OffscreenCanvas | null {
	if (
		maskLayerCanvas &&
		cachedMaskRef === mask &&
		cachedMaskColor === color &&
		cachedMaskOpacity === opacity &&
		cachedMaskViewMode === viewMode &&
		(viewMode !== 'cutout' || cachedMaskImageRef === img)
	) {
		return maskLayerCanvas;
	}

	const w = mask.width;
	const h = mask.height;
	maskLayerCanvas = ensureCanvas(maskLayerCanvas, w, h);
	const ctx = maskLayerCanvas.getContext('2d');
	if (!ctx) return null;

	ctx.clearRect(0, 0, w, h);

	if (viewMode === 'overlay') {
		drawMaskOverlay(ctx, mask, color, opacity);
	} else if (viewMode === 'outline') {
		if (cachedContourMaskRef !== mask) {
			cachedContours = extractContours(mask);
			cachedContourMaskRef = mask;
		}
		// effScale = 1 inside the cached layer; strokes will scale with zoom
		drawMaskOutline(ctx, mask, color, 1, cachedContours!);
	} else if (viewMode === 'cutout' && img) {
		if (mask.width !== img.naturalWidth || mask.height !== img.naturalHeight) {
			console.warn(
				`Cutout skipped: mask (${mask.width}x${mask.height}) != image (${img.naturalWidth}x${img.naturalHeight})`,
			);
			return null;
		}
		const offscreen = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
		const offCtx = offscreen.getContext('2d');
		if (offCtx) {
			offCtx.drawImage(img, 0, 0);
			const imageData = offCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
			for (let i = 0; i < imageData.data.length; i += 4) {
				imageData.data[i + 3] = mask.data[i + 3];
			}
			offCtx.putImageData(imageData, 0, 0);
			ctx.drawImage(offscreen, 0, 0);
		}
	}

	cachedMaskRef = mask;
	cachedMaskColor = color;
	cachedMaskOpacity = opacity;
	cachedMaskViewMode = viewMode;
	cachedMaskImageRef = img;

	return maskLayerCanvas;
}

export function renderHoverDeltaLayer(
	hoverMask: ImageData,
	committedMask: ImageData | null,
): OffscreenCanvas | null {
	if (
		hoverLayerCanvas &&
		cachedHoverMaskRef === hoverMask &&
		cachedCommittedMaskRef === committedMask
	) {
		return hoverLayerCanvas;
	}

	const w = hoverMask.width;
	const h = hoverMask.height;
	hoverLayerCanvas = ensureCanvas(hoverLayerCanvas, w, h);
	const ctx = hoverLayerCanvas.getContext('2d');
	if (!ctx) return null;

	ctx.clearRect(0, 0, w, h);

	if (!committedMask) {
		// No committed mask — show the full hover mask with green tint at 30% opacity
		drawMaskOverlay(ctx, hoverMask, '#22c55e', 0.3);
	} else {
		// Committed mask exists — compute additions-only delta
		const deltaData = new ImageData(w, h);

		let hasAdditions = false;
		for (let i = 0; i < w * h; i++) {
			const pi = i * 4;
			const hoverAlpha = hoverMask.data[pi + 3];
			const committedAlpha = committedMask.data[pi + 3];
			if (hoverAlpha > 128 && committedAlpha <= 128) {
				deltaData.data[pi] = 0x22;
				deltaData.data[pi + 1] = 0xc5;
				deltaData.data[pi + 2] = 0x5e;
				deltaData.data[pi + 3] = 77; // ~30% of 255
				hasAdditions = true;
			}
		}

		if (!hasAdditions) {
			cachedHoverMaskRef = hoverMask;
			cachedCommittedMaskRef = committedMask;
			return null;
		}

		const deltaCanvas = new OffscreenCanvas(w, h);
		const deltaCtx = deltaCanvas.getContext('2d');
		if (deltaCtx) {
			deltaCtx.putImageData(deltaData, 0, 0);
			ctx.drawImage(deltaCanvas, 0, 0);
		}
	}

	cachedHoverMaskRef = hoverMask;
	cachedCommittedMaskRef = committedMask;

	return hoverLayerCanvas;
}

/** Clear all layer caches (call on image change). */
export function invalidateAllLayers(): void {
	imageLayerCanvas = null;
	maskLayerCanvas = null;
	hoverLayerCanvas = null;

	cachedImageRef = null;

	cachedMaskRef = null;
	cachedMaskColor = '';
	cachedMaskOpacity = -1;
	cachedMaskViewMode = '';
	cachedMaskImageRef = null;

	cachedContours = null;
	cachedContourMaskRef = null;

	cachedHoverMaskRef = null;
	cachedCommittedMaskRef = null;
}
