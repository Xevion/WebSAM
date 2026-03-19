import { get, set } from 'idb-keyval';
import type { Point, Box } from '$lib/inference/types';

const PREFIX = 'websam:';

export interface CachedModelMeta {
	modelId: string;
	encoderFilename: string;
	decoderFilename: string;
	totalSize: number;
	cachedAt: number;
}

export async function getCachedModelMeta(modelId: string): Promise<CachedModelMeta | undefined> {
	return get<CachedModelMeta>(`${PREFIX}model:${modelId}`);
}

export async function setCachedModelMeta(meta: CachedModelMeta): Promise<void> {
	await set(`${PREFIX}model:${meta.modelId}`, meta);
}

export async function getLastSelectedModelId(): Promise<string | undefined> {
	return get<string>(`${PREFIX}lastModel`);
}

export async function setLastSelectedModelId(modelId: string): Promise<void> {
	await set(`${PREFIX}lastModel`, modelId);
}

export interface SessionState {
	points: Point[];
	box: Box | null;
	hasImage: boolean;
	maskViewMode: 'overlay' | 'outline' | 'cutout';
	maskOpacity: number;
	maskColor: string;
	interactionMode: 'point' | 'box' | 'everything';
}

export async function getSessionState(): Promise<SessionState | undefined> {
	return get<SessionState>(`${PREFIX}session`);
}

export async function setSessionState(state: SessionState): Promise<void> {
	await set(`${PREFIX}session`, state);
}
