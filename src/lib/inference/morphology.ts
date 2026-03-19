// 4-connected erosion: pixel survives only if all 4 neighbors are also set
export function erode(alpha: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
	const result = new Uint8ClampedArray(alpha.length);
	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			const idx = y * width + x;
			if (
				alpha[idx] > 128 &&
				alpha[idx - 1] > 128 &&
				alpha[idx + 1] > 128 &&
				alpha[idx - width] > 128 &&
				alpha[idx + width] > 128
			) {
				result[idx] = 255;
			}
		}
	}
	return result;
}

// 4-connected dilation: pixel is set if any of its 4 neighbors are set
export function dilate(alpha: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
	const result = new Uint8ClampedArray(alpha.length);
	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			const idx = y * width + x;
			if (
				alpha[idx] > 128 ||
				alpha[idx - 1] > 128 ||
				alpha[idx + 1] > 128 ||
				alpha[idx - width] > 128 ||
				alpha[idx + width] > 128
			) {
				result[idx] = 255;
			}
		}
	}
	return result;
}

// Opening (erode->dilate) removes small noise; closing (dilate->erode) fills small holes
export function smoothMask(alpha: Uint8ClampedArray, width: number, height: number, passes = 1): Uint8ClampedArray {
	let result = alpha;
	for (let i = 0; i < passes; i++) {
		result = erode(result, width, height);
		result = dilate(result, width, height);
		result = dilate(result, width, height);
		result = erode(result, width, height);
	}
	return result;
}
