import type { Tensor } from 'onnxruntime-web';
import { getOrt, type OnnxSession, type OrtModule } from './session';
import type { ImageEmbedding, PromptInput, MaskResult } from './types';
import { imageToModelCoords } from '$lib/utils/image';

export interface DecoderOptions {
	/** Previous low-res mask for iterative refinement [1, 1, 256, 256]. Pass null for first decode. */
	maskInput: Float32Array | null;
	/** Output dimensions to resize masks to (typically the original image dimensions). */
	outputWidth: number;
	outputHeight: number;
}

const LOW_RES_MASK_SIZE = 256;
const NUM_MASKS = 3;

/**
 * Runs the mask decoder with prompt inputs and returns segmentation masks.
 *
 * SAM1 (SlimSAM/MobileSAM) decoder I/O:
 *   Inputs: input_points [B, PB, N, 2], input_labels [B, PB, N] (int64),
 *           image_embeddings [B, 256, 64, 64], image_positional_embeddings [B, 256, 64, 64]
 *   Outputs: pred_masks [B, PB, 3, 256, 256], iou_scores [B, PB, 3]
 *
 * SAM2/SAM2.1 decoder I/O:
 *   Inputs: point_coords [NL, NP, 2], point_labels [NL, NP] (float32),
 *           image_embed [1, 256, 64, 64], high_res_feats_0 [1, 32, 256, 256],
 *           high_res_feats_1 [1, 64, 128, 128], mask_input [NL, 1, 256, 256],
 *           has_mask_input [NL]
 *   Outputs: masks [NL, M, H, W], iou_predictions [NL, 3]
 */
export async function decodeMask(
	session: OnnxSession,
	embedding: ImageEmbedding,
	prompt: PromptInput,
	options: DecoderOptions,
): Promise<MaskResult> {
	const ort = await getOrt();
	const { outputWidth, outputHeight } = options;
	const family = session.model.family;

	// Build point/label arrays from prompt
	const points: [number, number][] = [];
	const labels: number[] = [];

	if (prompt.points && prompt.points.length > 0) {
		for (const p of prompt.points) {
			const [sx, sy] = imageToModelCoords(p.x, p.y, outputWidth, outputHeight);
			points.push([sx, sy]);
			labels.push(p.label);
		}
	}

	if (prompt.box) {
		const [x1, y1] = imageToModelCoords(prompt.box.x1, prompt.box.y1, outputWidth, outputHeight);
		const [x2, y2] = imageToModelCoords(prompt.box.x2, prompt.box.y2, outputWidth, outputHeight);
		points.push([x1, y1], [x2, y2]);
		labels.push(2, 3); // box top-left=2, box bottom-right=3
	}

	// Must have at least one prompt point
	if (points.length === 0) {
		throw new Error('Decoder requires at least one point or box prompt');
	}

	const numPoints = points.length;

	let rawMasks: Float32Array;
	let rawScores: Float32Array;
	let maskWidth: number;
	let maskHeight: number;

	if (family === 'sam1' && embedding.type === 'sam1') {
		const sam1Result = await runSam1Decoder(ort, session, embedding, points, labels, numPoints);
		rawMasks = sam1Result.masks;
		rawScores = sam1Result.scores;
		maskWidth = sam1Result.maskWidth;
		maskHeight = sam1Result.maskHeight;
	} else if ((family === 'sam2' || family === 'sam2.1') && embedding.type === 'sam2') {
		const sam2Result = await runSam2Decoder(ort, session, embedding, points, labels, numPoints, options.maskInput);
		rawMasks = sam2Result.masks;
		rawScores = sam2Result.scores;
		maskWidth = sam2Result.maskWidth;
		maskHeight = sam2Result.maskHeight;
	} else {
		throw new Error(`Mismatched embedding type '${embedding.type}' for model family '${family}'`);
	}

	// Post-process: resize low-res masks to output dimensions and create ImageData
	return postProcessMasks(rawMasks, rawScores, maskWidth, maskHeight, outputWidth, outputHeight);
}

async function runSam1Decoder(
	ort: OrtModule,
	session: OnnxSession,
	embedding: Extract<ImageEmbedding, { type: 'sam1' }>,
	points: [number, number][],
	labels: number[],
	numPoints: number,
): Promise<{ masks: Float32Array; scores: Float32Array; maskWidth: number; maskHeight: number }> {
	// SAM1 decoder expects:
	// input_points: float32 [batch=1, point_batch=1, num_points, 2]
	// input_labels: int64 [batch=1, point_batch=1, num_points]
	// image_embeddings: float32 [batch=1, 256, 64, 64]
	// image_positional_embeddings: float32 [batch=1, 256, 64, 64]

	const pointsFlat = new Float32Array(numPoints * 2);
	for (let i = 0; i < numPoints; i++) {
		pointsFlat[i * 2] = points[i][0];
		pointsFlat[i * 2 + 1] = points[i][1];
	}

	const labelsFlat = new BigInt64Array(numPoints);
	for (let i = 0; i < numPoints; i++) {
		labelsFlat[i] = BigInt(labels[i]);
	}

	const feeds: Record<string, Tensor> = {
		input_points: new ort.Tensor('float32', pointsFlat, [1, 1, numPoints, 2]),
		input_labels: new ort.Tensor('int64', labelsFlat, [1, 1, numPoints]),
		image_embeddings: new ort.Tensor('float32', embedding.imageEmbeddings, [1, 256, 64, 64]),
		image_positional_embeddings: new ort.Tensor('float32', embedding.imagePositionalEmbeddings, [1, 256, 64, 64]),
	};

	let results: Awaited<ReturnType<typeof session.decoderSession.run>>;
	try {
		results = await session.decoderSession.run(feeds);
	} catch (err) {
		throw new Error('SAM1 decoder inference failed', { cause: err });
	}

	// pred_masks: [1, 1, 3, 256, 256]
	// iou_scores: [1, 1, 3]
	const maskTensor = results.pred_masks;
	const dims = maskTensor.dims;
	return {
		masks: maskTensor.data as Float32Array,
		scores: results.iou_scores.data as Float32Array,
		maskWidth: Number(dims[dims.length - 1]),
		maskHeight: Number(dims[dims.length - 2]),
	};
}

async function runSam2Decoder(
	ort: OrtModule,
	session: OnnxSession,
	embedding: Extract<ImageEmbedding, { type: 'sam2' }>,
	points: [number, number][],
	labels: number[],
	numPoints: number,
	maskInput: Float32Array | null,
): Promise<{ masks: Float32Array; scores: Float32Array; maskWidth: number; maskHeight: number }> {
	// SAM2 decoder expects:
	// point_coords: float32 [num_labels=1, num_points, 2]
	// point_labels: float32 [num_labels=1, num_points]
	// image_embed: float32 [1, 256, 64, 64]
	// high_res_feats_0: float32 [1, 32, 256, 256]
	// high_res_feats_1: float32 [1, 64, 128, 128]
	// mask_input: float32 [num_labels=1, 1, 256, 256]
	// has_mask_input: float32 [num_labels=1]

	const pointsFlat = new Float32Array(numPoints * 2);
	for (let i = 0; i < numPoints; i++) {
		pointsFlat[i * 2] = points[i][0];
		pointsFlat[i * 2 + 1] = points[i][1];
	}

	const labelsFlat = new Float32Array(numPoints);
	for (let i = 0; i < numPoints; i++) {
		labelsFlat[i] = labels[i]!;
	}

	const hasMask = maskInput != null;
	const maskData = maskInput ?? new Float32Array(LOW_RES_MASK_SIZE * LOW_RES_MASK_SIZE);

	const feeds: Record<string, Tensor> = {
		point_coords: new ort.Tensor('float32', pointsFlat, [1, numPoints, 2]),
		point_labels: new ort.Tensor('float32', labelsFlat, [1, numPoints]),
		image_embed: new ort.Tensor('float32', embedding.imageEmbed, [1, 256, 64, 64]),
		high_res_feats_0: new ort.Tensor('float32', embedding.highResFeats0, [1, 32, 256, 256]),
		high_res_feats_1: new ort.Tensor('float32', embedding.highResFeats1, [1, 64, 128, 128]),
		mask_input: new ort.Tensor('float32', maskData, [1, 1, LOW_RES_MASK_SIZE, LOW_RES_MASK_SIZE]),
		has_mask_input: new ort.Tensor('float32', new Float32Array([hasMask ? 1.0 : 0.0]), [1]),
	};

	let results: Awaited<ReturnType<typeof session.decoderSession.run>>;
	try {
		results = await session.decoderSession.run(feeds);
	} catch (err) {
		throw new Error('SAM2 decoder inference failed', { cause: err });
	}

	// masks: [1, num_masks, H, W] (H/W are typically 1024x1024 for SAM2)
	// iou_predictions: [1, 3]
	const maskTensor = results.masks;
	const dims = maskTensor.dims;
	return {
		masks: maskTensor.data as Float32Array,
		scores: results.iou_predictions.data as Float32Array,
		maskWidth: Number(dims[dims.length - 1]),
		maskHeight: Number(dims[dims.length - 2]),
	};
}

/**
 * Converts raw decoder mask logits into ImageData objects.
 * Applies bilinear resize from model output resolution to display dimensions.
 * Threshold at 0.0 for binary masks.
 *
 * // TODO: move to Web Worker for 4K+ images
 */
function postProcessMasks(
	rawMasks: Float32Array,
	rawScores: Float32Array,
	maskWidth: number,
	maskHeight: number,
	outputWidth: number,
	outputHeight: number,
): MaskResult {
	const scores: number[] = [];
	const masks: ImageData[] = [];

	const totalPixelsPerMask = maskWidth * maskHeight;

	// The encoder scales the longest edge to the mask dimension and zero-pads to a square.
	// To sample only from the image-content region (not padding), we use the same
	// scale factor: output pixel coords map to mask coords via this ratio.
	const maskScaleX = maskWidth / Math.max(outputWidth, outputHeight);
	const maskScaleY = maskHeight / Math.max(outputWidth, outputHeight);

	// Extract scores
	let bestIdx = 0;
	let bestScore = -Infinity;
	for (let i = 0; i < NUM_MASKS; i++) {
		const score = rawScores[i] ?? 0;
		scores.push(score);
		if (score > bestScore) {
			bestScore = score;
			bestIdx = i;
		}
	}

	// Build low-res masks buffer for potential iterative refinement
	const lowResMasks = new Float32Array(NUM_MASKS * LOW_RES_MASK_SIZE * LOW_RES_MASK_SIZE);
	const outputPixels = outputWidth * outputHeight;
	const rawLogits = new Float32Array(NUM_MASKS * outputPixels);

	for (let i = 0; i < NUM_MASKS; i++) {
		const maskOffset = i * totalPixelsPerMask;
		const imageData = new ImageData(outputWidth, outputHeight);
		const data = imageData.data;
		const logitOffset = i * outputPixels;

		// Single pass: bilinear sample once per pixel for both ImageData and rawLogits
		for (let y = 0; y < outputHeight; y++) {
			for (let x = 0; x < outputWidth; x++) {
				const srcX = x * maskScaleX;
				const srcY = y * maskScaleY;
				const logit = bilinearSample(rawMasks, maskOffset, maskWidth, maskHeight, srcX, srcY);

				const pixelIdx = (y * outputWidth + x) * 4;
				const inMask = logit > 0.0;
				data[pixelIdx] = inMask ? 255 : 0;
				data[pixelIdx + 1] = inMask ? 255 : 0;
				data[pixelIdx + 2] = inMask ? 255 : 0;
				data[pixelIdx + 3] = inMask ? 255 : 0;

				rawLogits[logitOffset + y * outputWidth + x] = logit;
			}
		}

		masks.push(imageData);

		// Downsample for low-res mask feedback (low-res covers the full padded square)
		const lrScaleX = LOW_RES_MASK_SIZE / maskWidth;
		const lrScaleY = LOW_RES_MASK_SIZE / maskHeight;
		const lrOffset = i * LOW_RES_MASK_SIZE * LOW_RES_MASK_SIZE;
		for (let y = 0; y < LOW_RES_MASK_SIZE; y++) {
			for (let x = 0; x < LOW_RES_MASK_SIZE; x++) {
				const srcX2 = x / lrScaleX;
				const srcY2 = y / lrScaleY;
				lowResMasks[lrOffset + y * LOW_RES_MASK_SIZE + x] = bilinearSample(
					rawMasks,
					maskOffset,
					maskWidth,
					maskHeight,
					srcX2,
					srcY2,
				);
			}
		}
	}

	return { masks, rawLogits, lowResMasks, scores, selectedIndex: bestIdx };
}

/**
 * Bilinear interpolation for sampling a 2D float buffer.
 */
function bilinearSample(
	data: Float32Array,
	offset: number,
	width: number,
	height: number,
	x: number,
	y: number,
): number {
	const x0 = Math.max(0, Math.min(Math.floor(x), width - 1));
	const y0 = Math.max(0, Math.min(Math.floor(y), height - 1));
	const x1 = Math.min(x0 + 1, width - 1);
	const y1 = Math.min(y0 + 1, height - 1);
	const fx = x - x0;
	const fy = y - y0;

	const v00 = data[offset + y0 * width + x0];
	const v10 = data[offset + y0 * width + x1];
	const v01 = data[offset + y1 * width + x0];
	const v11 = data[offset + y1 * width + x1];

	return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}
