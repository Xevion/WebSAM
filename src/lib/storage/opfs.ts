const MODEL_DIR = 'models';
const IMAGES_DIR = 'images';

async function getModelsDir(): Promise<FileSystemDirectoryHandle> {
	const root = await navigator.storage.getDirectory();
	return root.getDirectoryHandle(MODEL_DIR, { create: true });
}

async function getImagesDir(): Promise<FileSystemDirectoryHandle> {
	const root = await navigator.storage.getDirectory();
	return root.getDirectoryHandle(IMAGES_DIR, { create: true });
}

export async function writeModelFile(filename: string, data: ArrayBuffer): Promise<void> {
	const dir = await getModelsDir();
	const fileHandle = await dir.getFileHandle(filename, { create: true });
	const writable = await fileHandle.createWritable();
	try {
		await writable.write(data);
		await writable.close();
	} catch (err) {
		await writable.abort();
		throw err;
	}
}

export async function readModelFile(filename: string): Promise<ArrayBuffer | null> {
	try {
		const dir = await getModelsDir();
		const fileHandle = await dir.getFileHandle(filename);
		const file = await fileHandle.getFile();
		return file.arrayBuffer();
	} catch {
		return null;
	}
}

export async function deleteModelFile(filename: string): Promise<void> {
	try {
		const dir = await getModelsDir();
		await dir.removeEntry(filename);
	} catch {
		// File didn't exist
	}
}

export async function listModelFiles(): Promise<string[]> {
	const dir = await getModelsDir();
	const names: string[] = [];
	// TS DOM lib doesn't type the async iterator on FileSystemDirectoryHandle
	const entries = (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)[Symbol.asyncIterator]();
	for (let result = await entries.next(); !result.done; result = await entries.next()) {
		names.push(result.value[0]);
	}
	return names;
}

export async function writeCurrentImage(data: ArrayBuffer): Promise<void> {
	const dir = await getImagesDir();
	const fileHandle = await dir.getFileHandle('current-image', { create: true });
	const writable = await fileHandle.createWritable();
	try {
		await writable.write(data);
		await writable.close();
	} catch (err) {
		await writable.abort();
		throw err;
	}
}

export async function readCurrentImage(): Promise<Blob | null> {
	try {
		const dir = await getImagesDir();
		const fileHandle = await dir.getFileHandle('current-image');
		return fileHandle.getFile();
	} catch {
		return null;
	}
}

export async function deleteCurrentImage(): Promise<void> {
	try {
		const dir = await getImagesDir();
		await dir.removeEntry('current-image');
	} catch {
		// didn't exist
	}
}
