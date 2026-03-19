import type { OnnxSession } from './session';
import type { ImageEmbedding } from './encoder';
import type { PromptInput, MaskResult } from './types';

/**
 * Stub for mask decoding. In production, this would run the SAM decoder
 * with the prompt inputs and image embeddings to produce segmentation masks.
 */
export async function decodeMask(
	_session: OnnxSession,
	_embedding: ImageEmbedding,
	_prompt: PromptInput,
	outputWidth: number,
	outputHeight: number,
): Promise<MaskResult> {
	await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 200));

	const masks: ImageData[] = [];
	const scores: number[] = [];

	for (let i = 0; i < 3; i++) {
		const imageData = new ImageData(outputWidth, outputHeight);
		const data = imageData.data;

		for (let y = 0; y < outputHeight; y++) {
			for (let x = 0; x < outputWidth; x++) {
				const idx = (y * outputWidth + x) * 4;
				const cx = outputWidth / 2;
				const cy = outputHeight / 2;
				const radius = (Math.min(outputWidth, outputHeight) / 2) * (0.5 + i * 0.15);
				const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
				const inMask = dist < radius;
				data[idx] = inMask ? 255 : 0;
				data[idx + 1] = inMask ? 255 : 0;
				data[idx + 2] = inMask ? 255 : 0;
				data[idx + 3] = inMask ? 255 : 0;
			}
		}

		masks.push(imageData);
		scores.push(0.95 - i * 0.1);
	}

	return { masks, scores, selectedIndex: 0 };
}
