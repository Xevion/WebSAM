import { get, set } from 'idb-keyval';
import { getLogger } from '@logtape/logtape';
import type { Point, Box } from '$lib/inference/types';

const logger = getLogger(['websam', 'storage', 'metadata']);

const PREFIX = 'websam:';

export interface CachedModelMeta {
	modelId: string;
	encoderFilename: string;
	decoderFilename: string;
	totalSize: number;
	cachedAt: number;
}

export async function getCachedModelMeta(modelId: string): Promise<CachedModelMeta | undefined> {
	const result = await get<CachedModelMeta>(`${PREFIX}model:${modelId}`);
	logger.debug('Model metadata lookup', { modelId, found: result !== undefined });
	return result;
}

export async function setCachedModelMeta(meta: CachedModelMeta): Promise<void> {
	await set(`${PREFIX}model:${meta.modelId}`, meta);
	logger.debug('Model metadata saved', { modelId: meta.modelId });
}

export async function getLastSelectedModelId(): Promise<string | undefined> {
	const result = await get<string>(`${PREFIX}lastModel`);
	logger.debug('Last model ID retrieved', { modelId: result });
	return result;
}

export async function setLastSelectedModelId(modelId: string): Promise<void> {
	await set(`${PREFIX}lastModel`, modelId);
	logger.debug('Last model ID saved', { modelId });
}

export interface SessionState {
	points: Point[];
	box: Box | null;
	hasImage: boolean;
	maskViewMode: 'overlay' | 'outline' | 'cutout';
	maskOpacity: number;
	maskColor: string;
	maskThreshold?: number;
	maskSmoothPasses?: number;
	interactionMode: 'point' | 'box' | 'everything';
}

export async function getSessionState(): Promise<SessionState | undefined> {
	const result = await get<SessionState>(`${PREFIX}session`);
	logger.debug('Session state retrieved', { found: result !== undefined });
	return result;
}

export async function setSessionState(state: SessionState): Promise<void> {
	await set(`${PREFIX}session`, state);
	logger.debug('Session state saved', { interactionMode: state.interactionMode, hasImage: state.hasImage });
}
