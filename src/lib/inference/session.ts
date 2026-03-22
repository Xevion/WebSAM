import type { InferenceSession } from 'onnxruntime-web';
import { getLogger } from '@logtape/logtape';
import type { ModelInfo } from './types';

const logger = getLogger(['websam', 'inference', 'session']);

/**
 * Lazy-loaded ORT module. We dynamically import from 'onnxruntime-web/webgpu'
 * which bundles both WebGPU and WASM execution providers.
 * Dynamic import is required because ORT accesses browser globals (navigator, etc.)
 * which don't exist during SSR.
 *
 * The private helper function lets TypeScript infer OrtModule from the return
 * type of a function body import() expression, avoiding inline import() type annotations.
 */
async function _loadOrtModule() {
	return import('onnxruntime-web/webgpu');
}

export type OrtModule = Awaited<ReturnType<typeof _loadOrtModule>>;

let ortModule: OrtModule | null = null;

export async function getOrt(): Promise<OrtModule> {
	if (ortModule) return ortModule;
	// Import from /webgpu to include both WebGPU + WASM EPs
	ortModule = await _loadOrtModule();
	logger.info('ONNX Runtime module loaded');
	return ortModule;
}

export interface OnnxSession {
	encoderSession: InferenceSession;
	decoderSession: InferenceSession;
	model: ModelInfo;
}

export interface ModelBuffers {
	encoderBuffer: ArrayBuffer;
	decoderBuffer: ArrayBuffer;
}

let currentSession: OnnxSession | null = null;

/**
 * Configures ORT environment settings. Call before creating sessions.
 */
async function configureOrt(useWebGPU: boolean): Promise<void> {
	const ort = await getOrt();
	ort.env.logLevel = 'warning';

	// In production, WASM files are hosted on R2 and served via /wasm/ route.
	// In dev, Vite serves them from node_modules.
	if (!import.meta.env.DEV) {
		ort.env.wasm.wasmPaths = '/wasm/';
	}

	if (useWebGPU) {
		// WebGPU doesn't need WASM threading
		ort.env.wasm.numThreads = 1;
	} else {
		ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
	}
	logger.debug('ORT configured', { useWebGPU, wasmThreads: useWebGPU ? 1 : navigator.hardwareConcurrency || 4 });
}

/**
 * Creates ONNX InferenceSession instances from pre-downloaded model buffers.
 * Selects WebGPU EP for models that require it, WASM for others.
 */
export async function createSession(model: ModelInfo, buffers: ModelBuffers): Promise<OnnxSession> {
	logger.info('Creating ONNX sessions', {
		modelId: model.id,
		family: model.family,
		backend: model.requiresWebGPU ? 'webgpu' : 'wasm',
	});
	const ort = await getOrt();
	await configureOrt(model.requiresWebGPU);

	// Use WebGPU-only for GPU models (no WASM fallback).
	// Mixing EPs causes a Cast node fusion bug (ORT #27291) where int64->float32
	// and float32->float16 casts across EP boundaries get incorrectly fused.
	// graphOptimizationLevel is only effective for the WASM EP, not WebGPU.
	const executionProviders: InferenceSession.ExecutionProviderConfig[] = model.requiresWebGPU
		? [{ name: 'webgpu' }]
		: ['wasm'];

	// SAM2/SAM2.1 encoders are served as pre-optimized .ort files because the
	// raw .onnx Hiera backbone has shape annotation mismatches (declared=0 vs
	// inferred=4) that crash the WebGPU EP's internal transpose optimizer.
	// The .ort format bakes optimizations offline, so we disable runtime graph
	// optimization to avoid re-running them (and hitting the same crash).
	// Decoders remain as .onnx and don't need this workaround.
	const isPreOptimizedEncoder = model.encoderKey.endsWith('.ort');
	const encoderOptions: InferenceSession.SessionOptions = {
		executionProviders,
		...(isPreOptimizedEncoder && { graphOptimizationLevel: 'disabled' }),
	};

	const decoderOptions: InferenceSession.SessionOptions = {
		executionProviders,
	};

	// WebGPU EP only allows one session to be created at a time,
	// so sessions must be created sequentially (not Promise.all)
	const encoderSession = await ort.InferenceSession.create(buffers.encoderBuffer, encoderOptions);
	logger.debug('Encoder session created', { modelId: model.id });
	const decoderSession = await ort.InferenceSession.create(buffers.decoderBuffer, decoderOptions);
	logger.debug('Decoder session created', { modelId: model.id });

	currentSession = { encoderSession, decoderSession, model };
	logger.info('ONNX sessions ready', { modelId: model.id });
	return currentSession;
}

export function getSession(): OnnxSession | null {
	return currentSession;
}

/**
 * Destroys the current ONNX session and frees GPU/WASM memory.
 */
export async function destroySession(): Promise<void> {
	if (currentSession) {
		logger.debug('Destroying ONNX sessions');
		await Promise.all([currentSession.encoderSession.release(), currentSession.decoderSession.release()]);
		currentSession = null;
		logger.debug('ONNX sessions released');
	}
}
