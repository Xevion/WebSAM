import { get, set, del } from 'idb-keyval';

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

export async function deleteCachedModelMeta(modelId: string): Promise<void> {
	await del(`${PREFIX}model:${modelId}`);
}

export async function getLastSelectedModelId(): Promise<string | undefined> {
	return get<string>(`${PREFIX}lastModel`);
}

export async function setLastSelectedModelId(modelId: string): Promise<void> {
	await set(`${PREFIX}lastModel`, modelId);
}

export async function getPreferences(): Promise<Record<string, unknown> | undefined> {
	return get<Record<string, unknown>>(`${PREFIX}preferences`);
}

export async function setPreferences(prefs: Record<string, unknown>): Promise<void> {
	await set(`${PREFIX}preferences`, prefs);
}
