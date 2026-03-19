import type { Point, Box } from '$lib/inference/types';

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
	const { width, height, data } = mask;

	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.beginPath();

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = (y * width + x) * 4;
			const isMask = data[idx + 3] > 128;
			if (!isMask) continue;

			const isEdge =
				x === 0 ||
				x === width - 1 ||
				y === 0 ||
				y === height - 1 ||
				data[((y - 1) * width + x) * 4 + 3] <= 128 ||
				data[((y + 1) * width + x) * 4 + 3] <= 128 ||
				data[(y * width + (x - 1)) * 4 + 3] <= 128 ||
				data[(y * width + (x + 1)) * 4 + 3] <= 128;

			if (isEdge) {
				const px = x * scale + offsetX;
				const py = y * scale + offsetY;
				ctx.rect(px, py, scale, scale);
			}
		}
	}

	ctx.stroke();
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
