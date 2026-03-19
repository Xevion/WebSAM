import type { OnnxSession } from './session';
import type { ImageEmbedding } from './types';

/**
 * Stub for image encoding. In production, this would:
 * 1. Resize the image to 1024x1024
 * 2. Convert to CHW float tensor with model-appropriate normalization
 *    - SAM2: normalize to [-1, 1] range
 *    - SAM1: normalize with ImageNet mean/std
 * 3. Run the encoder ONNX session
 * 4. Return the embedding tensors
 */
export async function encodeImage(session: OnnxSession, _image: HTMLImageElement): Promise<ImageEmbedding> {
	await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

	const family = session.model.family;

	if (family === 'sam1') {
		return {
			type: 'sam1',
			imageEmbeddings: new Float32Array(1 * 256 * 64 * 64),
		};
	}

	return {
		type: 'sam2',
		imageEmbed: new Float32Array(1 * 256 * 64 * 64),
		highResFeats0: new Float32Array(1 * 32 * 256 * 256),
		highResFeats1: new Float32Array(1 * 64 * 128 * 128),
	};
}
