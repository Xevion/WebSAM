export interface Viewport {
	x: number;
	y: number;
	scale: number;
}

export interface Fit {
	scale: number;
	offsetX: number;
	offsetY: number;
}

/**
 * Returns transform parameters for ctx.setTransform(a, 0, 0, a, tx, ty).
 * Combines the fit-to-canvas transform, the user viewport (pan/zoom), and the device pixel ratio.
 */
export function computeTransform(fit: Fit, viewport: Viewport, dpr: number): { a: number; tx: number; ty: number } {
	const a = fit.scale * viewport.scale * dpr;
	const tx = (fit.offsetX * viewport.scale + viewport.x) * dpr;
	const ty = (fit.offsetY * viewport.scale + viewport.y) * dpr;
	return { a, tx, ty };
}

/**
 * Converts screen mouse event coordinates to image pixel coordinates.
 */
export function screenToImageCoords(
	clientX: number,
	clientY: number,
	canvasRect: { left: number; top: number },
	fit: Fit,
	viewport: Viewport,
): { x: number; y: number } {
	const cssX = clientX - canvasRect.left;
	const cssY = clientY - canvasRect.top;
	const s = fit.scale * viewport.scale;
	const x = (cssX - viewport.x - fit.offsetX * viewport.scale) / s;
	const y = (cssY - viewport.y - fit.offsetY * viewport.scale) / s;
	return { x, y };
}

/**
 * Zoom centered on a CSS point, clamping the resulting scale to [minScale, maxScale].
 */
export function zoomAtPoint(
	viewport: Viewport,
	cssX: number,
	cssY: number,
	factor: number,
	minScale: number,
	maxScale: number,
): Viewport {
	const newScale = Math.min(Math.max(viewport.scale * factor, minScale), maxScale);
	const ratio = newScale / viewport.scale;
	return {
		scale: newScale,
		x: cssX - (cssX - viewport.x) * ratio,
		y: cssY - (cssY - viewport.y) * ratio,
	};
}

/**
 * Shift the viewport pan by a CSS pixel delta.
 */
export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
	return {
		x: viewport.x + dx,
		y: viewport.y + dy,
		scale: viewport.scale,
	};
}

/**
 * Returns the identity viewport (no pan, no zoom).
 */
export function resetViewport(): Viewport {
	return { x: 0, y: 0, scale: 1 };
}

/**
 * The combined scale factor — useful for zoom-compensated stroke widths, etc.
 */
export function effectiveScale(fit: Fit, viewport: Viewport): number {
	return fit.scale * viewport.scale;
}
