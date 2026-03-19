import type { OnnxSession } from './session';
import type { ImageEmbedding, PromptInput, MaskResult } from './types';

export interface DecoderOptions {
	/** Previous low-res mask for iterative refinement [1, 1, 256, 256]. Pass null for first decode. */
	maskInput: Float32Array | null;
	/** Output dimensions to resize masks to (typically the original image dimensions). */
	outputWidth: number;
	outputHeight: number;
}

/**
 * Stub for mask decoding. In production, this would:
 * 1. Scale prompt coordinates from image space to 1024x1024 model space
 * 2. Build decoder input tensors (point_coords, point_labels, mask_input, has_mask_input)
 * 3. Run the decoder ONNX session with the image embedding
 * 4. Return raw logits, thresholded masks as ImageData, and low_res_masks for refinement
 */
export async function decodeMask(
	_session: OnnxSession,
	_embedding: ImageEmbedding,
	prompt: PromptInput,
	options: DecoderOptions,
): Promise<MaskResult> {
	await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 200));

	const { outputWidth, outputHeight } = options;
	const masks: ImageData[] = [];
	const scores: number[] = [];
	const numMasks = 3;
	const maskPixels = outputWidth * outputHeight;

	// Stub: center masks on the first point if available, otherwise center of image
	const cx = prompt.points?.[0]?.x ?? outputWidth / 2;
	const cy = prompt.points?.[0]?.y ?? outputHeight / 2;

	// Raw logits buffer: [1, 3, H, W]
	const rawLogits = new Float32Array(numMasks * maskPixels);

	for (let i = 0; i < numMasks; i++) {
		const imageData = new ImageData(outputWidth, outputHeight);
		const data = imageData.data;
		const radius = (Math.min(outputWidth, outputHeight) / 2) * (0.5 + i * 0.15);

		for (let y = 0; y < outputHeight; y++) {
			for (let x = 0; x < outputWidth; x++) {
				const pixelIdx = y * outputWidth + x;
				const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
				// Logit: positive inside mask, negative outside
				const logit = radius - dist;
				rawLogits[i * maskPixels + pixelIdx] = logit;

				const inMask = logit > 0;
				const rgba = pixelIdx * 4;
				data[rgba] = inMask ? 255 : 0;
				data[rgba + 1] = inMask ? 255 : 0;
				data[rgba + 2] = inMask ? 255 : 0;
				data[rgba + 3] = inMask ? 255 : 0;
			}
		}

		masks.push(imageData);
		scores.push(0.95 - i * 0.1);
	}

	// Stub low-res masks [1, 3, 256, 256]
	const lowResMasks = new Float32Array(numMasks * 256 * 256);

	return { masks, rawLogits, lowResMasks, scores, selectedIndex: 0 };
}
