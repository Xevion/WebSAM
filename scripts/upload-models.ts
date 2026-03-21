#!/usr/bin/env bun
/**
 * Downloads ONNX models from canonical sources and uploads to R2.
 * Also uploads ORT WASM files from node_modules.
 *
 * Usage:
 *   R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_ACCOUNT_ID=... \
 *     bun run scripts/upload-models.ts [--model=sam2.1-tiny] [--dry-run] [--wasm-only]
 *
 * Without --model, uploads all models.
 * With --dry-run, shows what would be uploaded without uploading.
 * With --wasm-only, only uploads WASM files (skips models).
 */
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { parseArgs } from 'util';
import { createReadStream, statSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const { values: args } = parseArgs({
	options: {
		model: { type: 'string' },
		'dry-run': { type: 'boolean', default: false },
		'wasm-only': { type: 'boolean', default: false },
	},
});

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const BUCKET = 'websam';

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ACCOUNT_ID) {
	console.error('Required env vars: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID');
	process.exit(1);
}

const s3 = new S3Client({
	region: 'auto',
	endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
});

interface FileUpload {
	sourceUrl: string;
	r2Key: string;
}

interface ZipUpload {
	zipUrl: string;
	files: Array<{
		/** Path inside the ZIP archive */
		zipPath: string;
		r2Key: string;
	}>;
}

interface ModelUploadSpec {
	modelId: string;
	files?: FileUpload[];
	zip?: ZipUpload;
}

// Canonical sources — download from HuggingFace, upload to R2 under versioned keys
const UPLOAD_SPECS: ModelUploadSpec[] = [
	{
		modelId: 'sam2.1-tiny',
		zip: {
			zipUrl:
				'https://huggingface.co/vietanhdev/segment-anything-2.1-onnx-models/resolve/main/sam2.1_hiera_tiny_20260221.zip',
			files: [
				{
					zipPath: 'sam2.1_hiera_tiny.encoder.onnx',
					r2Key: 'models/sam2.1-tiny/v1/encoder.onnx',
				},
				{
					zipPath: 'sam2.1_hiera_tiny.decoder.onnx',
					r2Key: 'models/sam2.1-tiny/v1/decoder.onnx',
				},
			],
		},
	},
	{
		modelId: 'sam2.1-small',
		zip: {
			zipUrl:
				'https://huggingface.co/vietanhdev/segment-anything-2.1-onnx-models/resolve/main/sam2.1_hiera_small_20260221.zip',
			files: [
				{
					zipPath: 'sam2.1_hiera_small.encoder.onnx',
					r2Key: 'models/sam2.1-small/v1/encoder.onnx',
				},
				{
					zipPath: 'sam2.1_hiera_small.decoder.onnx',
					r2Key: 'models/sam2.1-small/v1/decoder.onnx',
				},
			],
		},
	},
	{
		modelId: 'sam2-tiny',
		files: [
			{
				sourceUrl:
					'https://huggingface.co/onnx-community/sam2-hiera-tiny/resolve/main/onnx/vision_encoder.onnx',
				r2Key: 'models/sam2-tiny/v1/encoder.onnx',
			},
			{
				sourceUrl:
					'https://huggingface.co/onnx-community/sam2-hiera-tiny/resolve/main/onnx/prompt_encoder_mask_decoder.onnx',
				r2Key: 'models/sam2-tiny/v1/decoder.onnx',
			},
		],
	},
	{
		modelId: 'sam2-small',
		files: [
			{
				sourceUrl:
					'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_small.encoder.onnx',
				r2Key: 'models/sam2-small/v1/encoder.onnx',
			},
			{
				sourceUrl:
					'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_small.decoder.onnx',
				r2Key: 'models/sam2-small/v1/decoder.onnx',
			},
		],
	},
	{
		modelId: 'sam2-baseplus',
		files: [
			{
				sourceUrl:
					'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_base_plus.encoder.onnx',
				r2Key: 'models/sam2-baseplus/v1/encoder.onnx',
			},
			{
				sourceUrl:
					'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_base_plus.decoder.onnx',
				r2Key: 'models/sam2-baseplus/v1/decoder.onnx',
			},
		],
	},
	{
		modelId: 'sam2-large',
		files: [
			{
				sourceUrl:
					'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_large.encoder.onnx',
				r2Key: 'models/sam2-large/v1/encoder.onnx',
			},
			{
				sourceUrl:
					'https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/main/sam2_hiera_large.decoder.onnx',
				r2Key: 'models/sam2-large/v1/decoder.onnx',
			},
		],
	},
	{
		modelId: 'slimsam-77',
		files: [
			{
				sourceUrl:
					'https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/vision_encoder_quantized.onnx',
				r2Key: 'models/slimsam-77/v1/encoder.onnx',
			},
			{
				sourceUrl:
					'https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/prompt_encoder_mask_decoder_quantized.onnx',
				r2Key: 'models/slimsam-77/v1/decoder.onnx',
			},
		],
	},
];

// ORT WASM files served via /wasm/ route in production
const WASM_FILES = [
	'ort-wasm-simd-threaded.wasm',
	'ort-wasm-simd-threaded.asyncify.wasm',
	'ort-wasm-simd-threaded.jsep.wasm',
	'ort-wasm-simd-threaded.jspi.wasm',
];

async function getObjectMeta(key: string): Promise<{ exists: boolean; size?: number }> {
	try {
		const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
		return { exists: true, size: head.ContentLength };
	} catch {
		return { exists: false };
	}
}

async function downloadAndUpload(sourceUrl: string, r2Key: string): Promise<void> {
	console.log(`  Downloading: ${sourceUrl}`);
	const response = await fetch(sourceUrl, { redirect: 'follow' });
	if (!response.ok) throw new Error(`Download failed: ${response.status} ${sourceUrl}`);
	if (!response.body) throw new Error(`No response body: ${sourceUrl}`);

	const contentLength = Number(response.headers.get('content-length')) || 0;
	console.log(`  Size: ${(contentLength / 1024 / 1024).toFixed(1)} MB`);

	const meta = await getObjectMeta(r2Key);
	if (meta.exists && meta.size === contentLength && contentLength > 0) {
		console.log(`  SKIP (exists, ${meta.size} bytes matches): ${r2Key}`);
		return;
	}
	if (meta.exists && !contentLength) {
		console.log(`  SKIP (exists): ${r2Key}`);
		return;
	}

	console.log(`  Uploading: ${r2Key}`);
	const upload = new Upload({
		client: s3,
		params: {
			Bucket: BUCKET,
			Key: r2Key,
			Body: response.body as ReadableStream,
			ContentType: 'application/octet-stream',
			CacheControl: 'public, max-age=31536000, immutable',
		},
		partSize: 64 * 1024 * 1024,
		queueSize: 4,
	});

	upload.on('httpUploadProgress', (progress) => {
		if (progress.loaded && contentLength) {
			const pct = ((progress.loaded / contentLength) * 100).toFixed(1);
			process.stdout.write(`\r  Upload progress: ${pct}%`);
		}
	});

	await upload.done();
	console.log(`\n  Done: ${r2Key}`);
}

async function downloadZipAndUpload(zip: ZipUpload): Promise<void> {
	// Check if all target keys already exist
	const metas = await Promise.all(zip.files.map((f) => getObjectMeta(f.r2Key)));
	if (metas.every((m) => m.exists)) {
		for (const f of zip.files) console.log(`  SKIP (exists): ${f.r2Key}`);
		return;
	}

	const tmpDir = mkdtempSync(join(tmpdir(), 'websam-upload-'));
	try {
		const zipPath = join(tmpDir, 'archive.zip');
		console.log(`  Downloading ZIP: ${zip.zipUrl}`);
		const response = await fetch(zip.zipUrl, { redirect: 'follow' });
		if (!response.ok) throw new Error(`Download failed: ${response.status} ${zip.zipUrl}`);

		const contentLength = Number(response.headers.get('content-length')) || 0;
		if (contentLength) console.log(`  ZIP size: ${(contentLength / 1024 / 1024).toFixed(1)} MB`);

		console.log('  Writing to disk...');
		const arrayBuf = await response.arrayBuffer();
		await Bun.write(zipPath, arrayBuf);
		console.log('  Extracting...');
		execSync(`unzip -o "${zipPath}" -d "${tmpDir}"`, { stdio: 'pipe' });

		for (const file of zip.files) {
			const fileMeta = await getObjectMeta(file.r2Key);
			if (fileMeta.exists) {
				console.log(`  SKIP (exists): ${file.r2Key}`);
				continue;
			}
			const localPath = join(tmpDir, file.zipPath);
			await uploadLocalFile(localPath, file.r2Key, 'application/octet-stream');
		}
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
}

async function uploadLocalFile(localPath: string, r2Key: string, contentType = 'application/wasm'): Promise<void> {
	const stat = statSync(localPath);
	const meta = await getObjectMeta(r2Key);
	if (meta.exists && meta.size === stat.size) {
		console.log(`  SKIP (exists, ${meta.size} bytes matches): ${r2Key}`);
		return;
	}

	console.log(`  Size: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
	console.log(`  Uploading: ${r2Key}`);

	const upload = new Upload({
		client: s3,
		params: {
			Bucket: BUCKET,
			Key: r2Key,
			Body: createReadStream(localPath),
			ContentType: contentType,
			CacheControl: 'public, max-age=31536000, immutable',
		},
		partSize: 64 * 1024 * 1024,
		queueSize: 4,
	});

	upload.on('httpUploadProgress', (progress) => {
		if (progress.loaded) {
			const pct = ((progress.loaded / stat.size) * 100).toFixed(1);
			process.stdout.write(`\r  Upload progress: ${pct}%`);
		}
	});

	await upload.done();
	console.log(`\n  Done: ${r2Key}`);
}

async function uploadWasmFiles(): Promise<void> {
	console.log('Uploading ORT WASM files...\n');
	for (const file of WASM_FILES) {
		const localPath = resolve('node_modules/onnxruntime-web/dist', file);
		const r2Key = `wasm/${file}`;
		console.log(`WASM: ${file}`);
		if (args['dry-run']) {
			console.log(`  DRY RUN: ${localPath} → ${r2Key}`);
		} else {
			await uploadLocalFile(localPath, r2Key);
		}
	}
	console.log();
}

async function main() {
	if (!args['wasm-only']) {
		const specs = args.model ? UPLOAD_SPECS.filter((s) => s.modelId === args.model) : UPLOAD_SPECS;

		if (specs.length === 0) {
			console.error(`Unknown model: ${args.model}`);
			console.error(`Available: ${UPLOAD_SPECS.map((s) => s.modelId).join(', ')}`);
			process.exit(1);
		}

		console.log(`Uploading ${specs.length} model(s) to R2 bucket '${BUCKET}'...\n`);

		for (const spec of specs) {
			console.log(`Model: ${spec.modelId}`);
			if (spec.zip) {
				if (args['dry-run']) {
					console.log(`  DRY RUN (ZIP): ${spec.zip.zipUrl}`);
					for (const f of spec.zip.files) console.log(`    ${f.zipPath} → ${f.r2Key}`);
				} else {
					await downloadZipAndUpload(spec.zip);
				}
			}
			if (spec.files) {
				for (const file of spec.files) {
					if (args['dry-run']) {
						console.log(`  DRY RUN: ${file.sourceUrl} → ${file.r2Key}`);
					} else {
						await downloadAndUpload(file.sourceUrl, file.r2Key);
					}
				}
			}
			console.log();
		}
	}

	await uploadWasmFiles();

	console.log('Upload complete.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
