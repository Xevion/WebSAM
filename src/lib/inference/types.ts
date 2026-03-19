export interface ModelInfo {
	id: string;
	name: string;
	family: 'sam2.1' | 'sam2' | 'sam1' | 'mobile';
	variant: string;
	encoderSize: number;
	decoderSize: number;
	totalSize: number;
	description: string;
	encoderUrl: string;
	decoderUrl: string;
	quantization: 'fp32' | 'fp16' | 'int8' | 'int4';
	requiresWebGPU: boolean;
}

export interface Point {
	x: number;
	y: number;
	label: 1 | 0;
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

export interface MaskResult {
	masks: ImageData[];
	scores: number[];
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
