import type { ModelInfo } from './types';

/**
 * Stub for ONNX Runtime session management.
 * In production, this would create and manage InferenceSession instances.
 */

export interface OnnxSession {
	encoderSession: unknown;
	decoderSession: unknown;
	model: ModelInfo;
}

let currentSession: OnnxSession | null = null;

export async function createSession(model: ModelInfo): Promise<OnnxSession> {
	await new Promise((resolve) => setTimeout(resolve, 300));

	currentSession = {
		encoderSession: {},
		decoderSession: {},
		model,
	};

	return currentSession;
}

export function getSession(): OnnxSession | null {
	return currentSession;
}

export function destroySession(): void {
	currentSession = null;
}
