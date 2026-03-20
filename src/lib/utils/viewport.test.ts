import { describe, expect, it } from 'vitest';
import {
	computeTransform,
	effectiveScale,
	panBy,
	resetViewport,
	screenToImageCoords,
	zoomAtPoint,
} from './viewport';
import type { Fit, Viewport } from './viewport';

const identityViewport: Viewport = { x: 0, y: 0, scale: 1 };

describe('computeTransform', () => {
	it('returns identity-like transform for trivial inputs at dpr=1', () => {
		const fit: Fit = { scale: 1, offsetX: 0, offsetY: 0 };
		const { a, tx, ty } = computeTransform(fit, identityViewport, 1);
		expect(a).toBe(1);
		expect(tx).toBe(0);
		expect(ty).toBe(0);
	});

	it('scales by dpr at dpr=2 with identity viewport', () => {
		const fit: Fit = { scale: 1, offsetX: 0, offsetY: 0 };
		const { a, tx, ty } = computeTransform(fit, identityViewport, 2);
		expect(a).toBe(2);
		expect(tx).toBe(0);
		expect(ty).toBe(0);
	});

	it('incorporates fit offset and scale', () => {
		const fit: Fit = { scale: 0.5, offsetX: 100, offsetY: 50 };
		const { a, tx, ty } = computeTransform(fit, identityViewport, 1);
		expect(a).toBe(0.5);
		expect(tx).toBe(100);
		expect(ty).toBe(50);
	});

	it('incorporates viewport zoom and pan with dpr=2', () => {
		const fit: Fit = { scale: 0.5, offsetX: 100, offsetY: 50 };
		const viewport: Viewport = { x: 10, y: 20, scale: 2 };
		const { a, tx, ty } = computeTransform(fit, viewport, 2);
		// a = 0.5 * 2 * 2 = 2
		expect(a).toBe(2);
		// tx = (100 * 2 + 10) * 2 = 420
		expect(tx).toBe(420);
		// ty = (50 * 2 + 20) * 2 = 240
		expect(ty).toBe(240);
	});
});

describe('screenToImageCoords', () => {
	const rect = { left: 50, top: 30 };

	it('converts screen coords to image coords with identity viewport and no offset', () => {
		const fit: Fit = { scale: 1, offsetX: 0, offsetY: 0 };
		const { x, y } = screenToImageCoords(150, 130, rect, fit, identityViewport);
		// cssX = 150 - 50 = 100, cssY = 130 - 30 = 100
		expect(x).toBe(100);
		expect(y).toBe(100);
	});

	it('accounts for fit offset', () => {
		const fit: Fit = { scale: 1, offsetX: 20, offsetY: 10 };
		const { x, y } = screenToImageCoords(150, 130, rect, fit, identityViewport);
		// cssX = 100, imageX = (100 - 0 - 20) / 1 = 80
		// cssY = 100, imageY = (100 - 0 - 10) / 1 = 90
		expect(x).toBe(80);
		expect(y).toBe(90);
	});

	it('accounts for fit scale', () => {
		const fit: Fit = { scale: 2, offsetX: 0, offsetY: 0 };
		const { x, y } = screenToImageCoords(150, 130, rect, fit, identityViewport);
		// imageX = 100 / 2 = 50
		expect(x).toBe(50);
		expect(y).toBe(50);
	});

	it('accounts for viewport zoom and pan', () => {
		const fit: Fit = { scale: 1, offsetX: 0, offsetY: 0 };
		const viewport: Viewport = { x: 10, y: 20, scale: 2 };
		const { x, y } = screenToImageCoords(150, 130, rect, fit, viewport);
		// cssX = 100, imageX = (100 - 10 - 0*2) / (1*2) = 90/2 = 45
		// cssY = 100, imageY = (100 - 20 - 0*2) / (1*2) = 80/2 = 40
		expect(x).toBe(45);
		expect(y).toBe(40);
	});

	it('round-trip: image coord under cursor is stable after zoom', () => {
		const fit: Fit = { scale: 0.5, offsetX: 100, offsetY: 50 };
		const clientX = 300;
		const clientY = 200;

		// Get image coords before zoom
		const before = screenToImageCoords(clientX, clientY, rect, fit, identityViewport);

		// Zoom in 2x at the cursor position
		const cssX = clientX - rect.left;
		const cssY = clientY - rect.top;
		const zoomed = zoomAtPoint(identityViewport, cssX, cssY, 2, 0.1, 10);

		// Get image coords after zoom — should be the same point
		const after = screenToImageCoords(clientX, clientY, rect, fit, zoomed);

		expect(after.x).toBeCloseTo(before.x, 10);
		expect(after.y).toBeCloseTo(before.y, 10);
	});
});

describe('zoomAtPoint', () => {
	it('preserves the image coord under the zoom point', () => {
		const fit: Fit = { scale: 0.5, offsetX: 100, offsetY: 50 };
		const rect = { left: 0, top: 0 };
		const cssX = 250;
		const cssY = 170;

		const before = screenToImageCoords(cssX, cssY, rect, fit, identityViewport);
		const zoomed = zoomAtPoint(identityViewport, cssX, cssY, 3, 0.1, 10);
		const after = screenToImageCoords(cssX, cssY, rect, fit, zoomed);

		expect(after.x).toBeCloseTo(before.x, 10);
		expect(after.y).toBeCloseTo(before.y, 10);
	});

	it('clamps scale to minimum', () => {
		const result = zoomAtPoint(identityViewport, 0, 0, 0.01, 0.5, 10);
		expect(result.scale).toBe(0.5);
	});

	it('clamps scale to maximum', () => {
		const result = zoomAtPoint(identityViewport, 0, 0, 100, 0.1, 5);
		expect(result.scale).toBe(5);
	});

	it('zooms in by the given factor when within bounds', () => {
		const result = zoomAtPoint(identityViewport, 0, 0, 2, 0.1, 10);
		expect(result.scale).toBe(2);
	});

	it('does not mutate the input viewport', () => {
		const original: Viewport = { x: 10, y: 20, scale: 1.5 };
		const copy = { ...original };
		zoomAtPoint(original, 100, 100, 2, 0.1, 10);
		expect(original).toEqual(copy);
	});
});

describe('panBy', () => {
	it('shifts the viewport by the given delta', () => {
		const result = panBy(identityViewport, 15, -25);
		expect(result).toEqual({ x: 15, y: -25, scale: 1 });
	});

	it('is additive', () => {
		const first = panBy(identityViewport, 10, 20);
		const second = panBy(first, 5, -10);
		expect(second).toEqual({ x: 15, y: 10, scale: 1 });
	});

	it('preserves scale', () => {
		const viewport: Viewport = { x: 0, y: 0, scale: 3 };
		const result = panBy(viewport, 100, 200);
		expect(result.scale).toBe(3);
	});

	it('does not mutate the input viewport', () => {
		const original: Viewport = { x: 5, y: 10, scale: 2 };
		const copy = { ...original };
		panBy(original, 100, 200);
		expect(original).toEqual(copy);
	});
});

describe('resetViewport', () => {
	it('returns identity viewport', () => {
		expect(resetViewport()).toEqual({ x: 0, y: 0, scale: 1 });
	});

	it('returns a new object each time', () => {
		const a = resetViewport();
		const b = resetViewport();
		expect(a).not.toBe(b);
		expect(a).toEqual(b);
	});
});

describe('effectiveScale', () => {
	it('returns fit.scale * viewport.scale', () => {
		const fit: Fit = { scale: 0.5, offsetX: 0, offsetY: 0 };
		const viewport: Viewport = { x: 0, y: 0, scale: 3 };
		expect(effectiveScale(fit, viewport)).toBe(1.5);
	});

	it('returns fit.scale for identity viewport', () => {
		const fit: Fit = { scale: 2.5, offsetX: 100, offsetY: 50 };
		expect(effectiveScale(fit, identityViewport)).toBe(2.5);
	});
});
