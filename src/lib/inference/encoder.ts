import type { OnnxSession } from './session';

export interface ImageEmbedding {
	data: Float32Array;
	width: number;
	height: number;
}

/**
 * Stub for image encoding. In production, this would run the SAM encoder
 * through ONNX Runtime to produce image embeddings.
 */
export async function encodeImage(_session: OnnxSession, _image: HTMLImageElement): Promise<ImageEmbedding> {
	await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

	return {
		data: new Float32Array(256 * 64 * 64),
		width: 64,
		height: 64,
	};
}
