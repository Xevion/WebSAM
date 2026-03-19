import type { InferenceSession } from 'onnxruntime-web';
import type { ModelInfo } from './types';

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

	if (useWebGPU) {
		// WebGPU doesn't need WASM threading
		ort.env.wasm.numThreads = 1;
	} else {
		ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
	}
}

/**
 * Creates ONNX InferenceSession instances from pre-downloaded model buffers.
 * Selects WebGPU EP for models that require it, WASM for others.
 */
export async function createSession(model: ModelInfo, buffers: ModelBuffers): Promise<OnnxSession> {
	const ort = await getOrt();
	await configureOrt(model.requiresWebGPU);

	// Use WebGPU-only for GPU models (no WASM fallback).
	// Mixing EPs causes a Cast node fusion bug (ORT #27291) where int64->float32
	// and float32->float16 casts across EP boundaries get incorrectly fused.
	// graphOptimizationLevel is only effective for the WASM EP, not WebGPU.
	const executionProviders: InferenceSession.ExecutionProviderConfig[] = model.requiresWebGPU
		? [{ name: 'webgpu' }]
		: ['wasm'];

	// SAM2/SAM2.1 encoder ONNX files have a shape annotation mismatch in the
	// Hiera backbone (declared=5 vs inferred=4 on dimension 0). Disabling graph
	// optimization skips the shape inference validation that triggers this error.
	// The decoder graph is clean and doesn't need this workaround.
	const encoderOptions: InferenceSession.SessionOptions = {
		executionProviders,
		...(model.family !== 'sam1' && { graphOptimizationLevel: 'disabled' }),
	};

	const decoderOptions: InferenceSession.SessionOptions = {
		executionProviders,
	};

	// WebGPU EP only allows one session to be created at a time,
	// so sessions must be created sequentially (not Promise.all)
	const encoderSession = await ort.InferenceSession.create(buffers.encoderBuffer, encoderOptions);
	const decoderSession = await ort.InferenceSession.create(buffers.decoderBuffer, decoderOptions);

	currentSession = { encoderSession, decoderSession, model };
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
		await Promise.all([currentSession.encoderSession.release(), currentSession.decoderSession.release()]);
		currentSession = null;
	}
}
