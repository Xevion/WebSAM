import type { ModelInfo } from './types';

const MB = 1024 * 1024;

/**
 * When running locally in dev mode, models are served from /models/ by the Vite dev server.
 * In production, these URLs should point to a CDN (HuggingFace, R2, etc.).
 *
 * The localPath fields map to files in the project-root models/ directory.
 * The encoderUrl/decoderUrl fields are the remote fetch URLs for production.
 */
export const MODEL_REGISTRY: ModelInfo[] = [
	{
		id: 'sam2.1-tiny',
		name: 'SAM 2.1 Tiny',
		family: 'sam2.1',
		variant: 'tiny',
		encoderSize: 129 * MB,
		decoderSize: 16 * MB,
		totalSize: 145 * MB,
		description: 'Fastest SAM 2.1, pre-optimized encoder',
		encoderUrl: '/models/sam2.1-tiny/sam2.1_hiera_tiny.encoder.with_runtime_opt.ort',
		decoderUrl: '/models/sam2.1-tiny/sam2.1_hiera_tiny.decoder.onnx',
		quantization: 'fp32',
		requiresWebGPU: true,
	},
	{
		id: 'sam2.1-small',
		name: 'SAM 2.1 Small',
		family: 'sam2.1',
		variant: 'small',
		encoderSize: 156 * MB,
		decoderSize: 16 * MB,
		totalSize: 172 * MB,
		description: 'Balanced speed and accuracy for SAM 2.1',
		encoderUrl: '/models/sam2.1-small/sam2.1_hiera_small.encoder.with_runtime_opt.ort',
		decoderUrl: '/models/sam2.1-small/sam2.1_hiera_small.decoder.onnx',
		quantization: 'fp32',
		requiresWebGPU: true,
	},
	// TODO: re-enable when pre-extracted ONNX URLs are available
	// These entries point to .zip files with no extraction logic and have empty decoderUrl.
	// {
	// 	id: 'sam2.1-baseplus',
	// 	name: 'SAM 2.1 Base+',
	// 	family: 'sam2.1',
	// 	variant: 'base+',
	// 	encoderSize: 340 * MB,
	// 	decoderSize: 21 * MB,
	// 	totalSize: 361 * MB,
	// 	description: 'Higher accuracy SAM 2.1 model',
	// 	encoderUrl:
	// 		'https://huggingface.co/vietanhdev/segment-anything-2.1-onnx-models/resolve/main/sam2.1_hiera_base_plus_20260221.zip',
	// 	decoderUrl: '',
	// 	quantization: 'fp32',
	// 	requiresWebGPU: true,
	// },
	// {
	// 	id: 'sam2.1-large',
	// 	name: 'SAM 2.1 Large',
	// 	family: 'sam2.1',
	// 	variant: 'large',
	// 	encoderSize: 889 * MB,
	// 	decoderSize: 21 * MB,
	// 	totalSize: 910 * MB,
	// 	description: 'Highest accuracy SAM 2.1, large download',
	// 	encoderUrl:
	// 		'https://huggingface.co/vietanhdev/segment-anything-2.1-onnx-models/resolve/main/sam2.1_hiera_large_20260221.zip',
	// 	decoderUrl: '',
	// 	quantization: 'fp32',
	// 	requiresWebGPU: true,
	// },
	{
		id: 'sam2-tiny',
		name: 'SAM 2 Tiny',
		family: 'sam2',
		variant: 'tiny',
		encoderSize: 128 * MB,
		decoderSize: 20 * MB,
		totalSize: 148 * MB,
		description: 'Fastest SAM 2 model (prefer SAM 2.1 for better accuracy)',
		encoderUrl: 'https://huggingface.co/onnx-community/sam2-hiera-tiny/resolve/main/onnx/vision_encoder.onnx',
		decoderUrl:
			'https://huggingface.co/onnx-community/sam2-hiera-tiny/resolve/main/onnx/prompt_encoder_mask_decoder.onnx',
		quantization: 'fp32',
		requiresWebGPU: true,
	},
	{
		id: 'sam2-small',
		name: 'SAM 2 Small',
		family: 'sam2',
		variant: 'small',
		encoderSize: 163 * MB,
		decoderSize: 21 * MB,
		totalSize: 184 * MB,
		description: 'Balanced SAM 2 model',
		encoderUrl:
			'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_small.encoder.onnx',
		decoderUrl:
			'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_small.decoder.onnx',
		quantization: 'fp32',
		requiresWebGPU: true,
	},
	{
		id: 'sam2-baseplus',
		name: 'SAM 2 Base+',
		family: 'sam2',
		variant: 'base+',
		encoderSize: 340 * MB,
		decoderSize: 21 * MB,
		totalSize: 361 * MB,
		description: 'Higher accuracy SAM 2 model',
		encoderUrl:
			'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_base_plus.encoder.onnx',
		decoderUrl:
			'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_base_plus.decoder.onnx',
		quantization: 'fp32',
		requiresWebGPU: true,
	},
	{
		id: 'sam2-large',
		name: 'SAM 2 Large',
		family: 'sam2',
		variant: 'large',
		encoderSize: 889 * MB,
		decoderSize: 21 * MB,
		totalSize: 910 * MB,
		description: 'Highest accuracy SAM 2, large download',
		encoderUrl:
			'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_large.encoder.onnx',
		decoderUrl:
			'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_large.decoder.onnx',
		quantization: 'fp32',
		requiresWebGPU: true,
	},
	{
		id: 'slimsam-77',
		name: 'SlimSAM-77',
		family: 'sam1',
		variant: 'slimsam-77',
		encoderSize: 9 * MB,
		decoderSize: 5 * MB,
		totalSize: 14 * MB,
		description: 'Recommended CPU-only model, 77% pruned SAM (~14 MB INT8)',
		encoderUrl: 'https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/vision_encoder_quantized.onnx',
		decoderUrl:
			'https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/prompt_encoder_mask_decoder_quantized.onnx',
		quantization: 'int8',
		requiresWebGPU: false,
	},
	// TODO: re-enable when real ONNX URLs are available (currently placeholder example.com URLs)
	// {
	// 	id: 'mobilesam',
	// 	name: 'MobileSAM',
	// 	family: 'sam1',
	// 	variant: 'mobile',
	// 	encoderSize: 35 * MB,
	// 	decoderSize: 4 * MB,
	// 	totalSize: 39 * MB,
	// 	description: 'Lightweight model for mobile and edge devices',
	// 	encoderUrl: 'https://example.com/mobilesam-encoder.onnx',
	// 	decoderUrl: 'https://example.com/mobilesam-decoder.onnx',
	// 	quantization: 'int8',
	// 	requiresWebGPU: false,
	// },
];

export const MODEL_FAMILIES = [
	{ id: 'sam2.1' as const, label: 'SAM 2.1' },
	{ id: 'sam2' as const, label: 'SAM 2' },
	{ id: 'sam1' as const, label: 'SAM 1 / Lightweight' },
];

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / MB).toFixed(0)} MB`;
}
