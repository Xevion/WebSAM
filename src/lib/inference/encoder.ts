import { getOrt, type OnnxSession } from './session';
import type { ImageEmbedding, RawImageData } from './types';

/** ImageNet normalization constants used by both SAM1 and SAM2 */
const IMAGE_MEAN = [0.485, 0.456, 0.406] as const;
const IMAGE_STD = [0.229, 0.224, 0.225] as const;
const MODEL_INPUT_SIZE = 1024;

/**
 * Preprocesses raw pixel data for SAM encoder input:
 * 1. Resize longest edge to 1024, preserving aspect ratio
 * 2. Pad to 1024x1024
 * 3. Normalize with ImageNet mean/std
 * 4. Convert HWC -> CHW layout
 *
 * Returns a Float32Array in [1, 3, 1024, 1024] layout.
 */
function preprocessImage(imageData: RawImageData): Float32Array {
	const { width: w, height: h } = imageData;

	// Scale so longest edge = 1024
	const scale = MODEL_INPUT_SIZE / Math.max(w, h);
	const newW = Math.round(w * scale);
	const newH = Math.round(h * scale);

	// Draw source pixels onto an OffscreenCanvas at original size, then resize
	const srcCanvas = new OffscreenCanvas(w, h);
	const srcCtx = srcCanvas.getContext('2d');
	if (!srcCtx) throw new Error('Failed to create offscreen canvas context');
	// Structured clone may produce a Uint8ClampedArray backed by SharedArrayBuffer,
	// but ImageData requires a plain ArrayBuffer backing. Copy to ensure compatibility.
	const pixelData = new Uint8ClampedArray(imageData.data);
	const srcImageData = new ImageData(pixelData, w, h);
	srcCtx.putImageData(srcImageData, 0, 0);

	// Resize into a 1024x1024 canvas (zero-padded)
	const canvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Failed to create offscreen canvas context');
	ctx.drawImage(srcCanvas, 0, 0, newW, newH);

	const resized = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
	const pixels = resized.data; // RGBA, HWC

	const totalPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
	const tensor = new Float32Array(3 * totalPixels);

	// rescale_factor = 1/255, then normalize with mean/std
	for (let i = 0; i < totalPixels; i++) {
		const rgbaIdx = i * 4;
		for (let c = 0; c < 3; c++) {
			const val = pixels[rgbaIdx + c] / 255.0;
			tensor[c * totalPixels + i] = (val - IMAGE_MEAN[c]) / IMAGE_STD[c];
		}
	}

	return tensor;
}

/**
 * Runs the image through the SAM encoder and returns cached embedding tensors.
 * The encoding is the expensive step (~500ms-25s depending on model and backend).
 * Results should be cached and reused for all decoder calls on the same image.
 */
export async function encodeImage(session: OnnxSession, imageData: RawImageData): Promise<ImageEmbedding> {
	const ort = await getOrt();
	const family = session.model.family;
	const inputTensor = preprocessImage(imageData);

	if (family === 'sam1') {
		// SlimSAM / MobileSAM encoder
		// Input: pixel_values [batch, 3, 1024, 1024]
		// Outputs: image_embeddings [batch, 256, 64, 64], image_positional_embeddings [batch, 256, 64, 64]
		const feeds = {
			pixel_values: new ort.Tensor('float32', inputTensor, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]),
		};

		let results: Awaited<ReturnType<typeof session.encoderSession.run>>;
		try {
			results = await session.encoderSession.run(feeds);
		} catch (err) {
			throw new Error('SAM1 encoder inference failed', { cause: err });
		}

		return {
			type: 'sam1',
			imageEmbeddings: results.image_embeddings.data as Float32Array,
			imagePositionalEmbeddings: results.image_positional_embeddings.data as Float32Array,
		};
	}

	// SAM2 / SAM2.1 encoder
	// Input: image [1, 3, 1024, 1024]
	// Outputs: image_embed [1, 256, 64, 64], high_res_feats_0 [1, 32, 256, 256], high_res_feats_1 [1, 64, 128, 128]
	const feeds = {
		image: new ort.Tensor('float32', inputTensor, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]),
	};

	let results: Awaited<ReturnType<typeof session.encoderSession.run>>;
	try {
		results = await session.encoderSession.run(feeds);
	} catch (err) {
		throw new Error('SAM2 encoder inference failed', { cause: err });
	}

	return {
		type: 'sam2',
		imageEmbed: results.image_embed.data as Float32Array,
		highResFeats0: results.high_res_feats_0.data as Float32Array,
		highResFeats1: results.high_res_feats_1.data as Float32Array,
	};
}
