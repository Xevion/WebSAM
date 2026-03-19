export interface ModelInfo {
	id: string;
	name: string;
	family: 'sam2.1' | 'sam2' | 'sam1';
	variant: string;
	encoderSize: number;
	decoderSize: number;
	totalSize: number;
	description: string;
	encoderUrl: string;
	decoderUrl: string;
	quantization: 'fp32' | 'fp16' | 'int8';
	requiresWebGPU: boolean;
}

/**
 * Point prompt in image-pixel coordinates.
 * Labels: 1=foreground, 0=background, 2=box top-left, 3=box bottom-right.
 */
export interface Point {
	x: number;
	y: number;
	label: 0 | 1 | 2 | 3;
}

export interface Box {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface PromptInput {
	points?: Point[];
	box?: Box;
	everything?: boolean;
}

/**
 * SAM1 encoder output: only image_embeddings.
 */
export interface Sam1Embedding {
	type: 'sam1';
	imageEmbeddings: Float32Array; // [1, 256, 64, 64]
}

/**
 * SAM2/SAM2.1 encoder output: image_embed + two high-res feature maps.
 */
export interface Sam2Embedding {
	type: 'sam2';
	imageEmbed: Float32Array; // [1, 256, 64, 64]
	highResFeats0: Float32Array; // [1, 32, 256, 256]
	highResFeats1: Float32Array; // [1, 64, 128, 128]
}

export type ImageEmbedding = Sam1Embedding | Sam2Embedding;

/**
 * Raw decoder output before thresholding.
 * Masks are float logits (threshold at 0.0 for binary mask).
 * lowResMasks can be fed back as mask_input for iterative refinement.
 */
export interface MaskResult {
	masks: ImageData[];
	rawLogits: Float32Array; // [1, 3, H, W] raw float logits for threshold slider
	lowResMasks: Float32Array; // [1, 3, 256, 256] for mask feedback loop
	scores: number[]; // IoU scores per mask
	selectedIndex: number;
}

export type DownloadStage = 'idle' | 'downloading-encoder' | 'downloading-decoder' | 'initializing' | 'ready' | 'error';
export type InferenceStage = 'idle' | 'encoding' | 'decoding' | 'complete' | 'error';

export interface DownloadProgress {
	stage: DownloadStage;
	bytesDownloaded: number;
	totalBytes: number;
	error?: string;
}

export interface InferenceProgress {
	stage: InferenceStage;
	timeMs?: number;
	error?: string;
}
