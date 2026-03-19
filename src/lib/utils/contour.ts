import { isoLines } from 'marching-squares';

/**
 * Extract contour polygons from a binary mask using marching squares.
 * Returns an array of polygons, where each polygon is an array of [x, y] points.
 */
export function extractContours(mask: ImageData, threshold: number = 128): [number, number][][] {
	const { width, height, data } = mask;

	// marching-squares expects a 2D array [rows][cols] of scalar values;
	// we feed it the alpha channel so contours follow mask boundaries.
	const grid: number[][] = [];
	for (let y = 0; y < height; y++) {
		const row: number[] = [];
		for (let x = 0; x < width; x++) {
			row.push(data[(y * width + x) * 4 + 3]!);
		}
		grid.push(row);
	}

	const contours = isoLines(grid, [threshold]);

	// isoLines returns one Ring[] per threshold; we only pass one
	return (contours[0] ?? []) as [number, number][][];
}
