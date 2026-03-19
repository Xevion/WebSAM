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
	ctx: CanvasRenderingContext2D,
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
	ctx: CanvasRenderingContext2D,
	mask: ImageData,
	color: string,
	scale: number,
	offsetX: number,
	offsetY: number,
): void {
	const contours = extractContours(mask);

	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.lineJoin = 'round';

	for (const polygon of contours) {
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
