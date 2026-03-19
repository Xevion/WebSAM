/**
 * Load an image from a File object and return an HTMLImageElement.
 */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error(`Failed to load image: ${file.name}`));
		};
		img.src = url;
	});
}

/**
 * Compute scale and offset to fit an image in a canvas while maintaining aspect ratio.
 */
export function computeFit(
	imageWidth: number,
	imageHeight: number,
	canvasWidth: number,
	canvasHeight: number,
): { scale: number; offsetX: number; offsetY: number } {
	const scaleX = canvasWidth / imageWidth;
	const scaleY = canvasHeight / imageHeight;
	const scale = Math.min(scaleX, scaleY);
	const offsetX = (canvasWidth - imageWidth * scale) / 2;
	const offsetY = (canvasHeight - imageHeight * scale) / 2;
	return { scale, offsetX, offsetY };
}

/**
 * Convert canvas coordinates to image coordinates using the current transform.
 */
export function canvasToImageCoords(
	canvasX: number,
	canvasY: number,
	scale: number,
	offsetX: number,
	offsetY: number,
): { x: number; y: number } {
	return {
		x: (canvasX - offsetX) / scale,
		y: (canvasY - offsetY) / scale,
	};
}

/**
 * Export an ImageData mask as a PNG Blob.
 */
export function maskToBlob(mask: ImageData): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = mask.width;
	canvas.height = mask.height;
	const ctx = canvas.getContext('2d')!;
	ctx.putImageData(mask, 0, 0);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error('Failed to export mask'));
		}, 'image/png');
	});
}

/**
 * Create a cutout: the original image with the mask applied as alpha channel.
 */
export function createCutout(image: HTMLImageElement, mask: ImageData): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	const ctx = canvas.getContext('2d')!;

	ctx.drawImage(image, 0, 0);
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

	for (let i = 0; i < imageData.data.length; i += 4) {
		imageData.data[i + 3] = mask.data[i + 3]!;
	}

	ctx.putImageData(imageData, 0, 0);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error('Failed to create cutout'));
		}, 'image/png');
	});
}
