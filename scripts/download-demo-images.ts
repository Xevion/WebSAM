#!/usr/bin/env bun
/**
 * Downloads demo images from Pexels API and generates the manifest.
 *
 * Usage: PEXELS_API_KEY=<key> bun run scripts/download-demo-images.ts
 *
 * Downloads images to static/demos/ and writes static/demo-images.json.
 * Uses ImageMagick `identify` for metadata extraction.
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_API_KEY) {
	console.error('PEXELS_API_KEY environment variable is required');
	process.exit(1);
}

const STATIC_DIR = join(import.meta.dir, '..', 'static');
const DEMOS_DIR = join(STATIC_DIR, 'demos');
const MANIFEST_PATH = join(STATIC_DIR, 'demo-images.json');

interface ImageSpec {
	id: string;
	name: string;
	description: string;
	tags: string[];
	query: string;
	/** Preferred orientation: landscape, portrait, or square */
	orientation?: 'landscape' | 'portrait' | 'square';
}

// Wave 1: Core Showcase (20 images)
const IMAGE_SPECS: ImageSpec[] = [
	{
		id: 'golden-retriever',
		name: 'Golden Retriever in Grass',
		description: 'A golden retriever sitting in tall grass. Complex fur boundaries make this a great SAM showcase.',
		tags: ['animal', 'fur', 'outdoor', 'easy', 'photograph', 'nature'],
		query: 'golden retriever grass',
		orientation: 'landscape',
	},
	{
		id: 'cat-portrait',
		name: 'Cat Portrait Close-Up',
		description: 'Close-up portrait of a cat. Whiskers and fur boundaries challenge precise segmentation.',
		tags: ['animal', 'fur', 'macro', 'fine-detail', 'photograph'],
		query: 'cat face close up portrait',
		orientation: 'portrait',
	},
	{
		id: 'parrot-branch',
		name: 'Parrot on Branch',
		description:
			'A colorful parrot perched on a branch. Feather detail against foliage tests fine boundary detection.',
		tags: ['bird', 'feathers', 'fine-detail', 'moderate', 'photograph', 'nature'],
		query: 'colorful parrot branch',
		orientation: 'landscape',
	},
	{
		id: 'curly-hair-person',
		name: 'Person with Curly Hair',
		description: 'Portrait of a person with curly hair. Hair segmentation is the #1 real-world use case.',
		tags: ['person', 'hair', 'challenging', 'photograph'],
		query: 'person curly hair portrait',
		orientation: 'portrait',
	},
	{
		id: 'street-market',
		name: 'Busy Street Market',
		description:
			'Overhead view of a colorful street market with produce stalls. Ideal for everything-mode segmentation.',
		tags: ['food', 'market', 'dense-objects', 'outdoor', 'moderate', 'photograph'],
		query: 'street market overhead colorful produce',
		orientation: 'landscape',
	},
	{
		id: 'bicycle-wall',
		name: 'Bicycle Against Wall',
		description: 'A bicycle leaning against a textured wall. Thin spokes test fine structure segmentation.',
		tags: ['bicycle', 'thin-structures', 'urban', 'challenging', 'photograph'],
		query: 'bicycle leaning against wall',
		orientation: 'landscape',
	},
	{
		id: 'coral-reef',
		name: 'Coral Reef',
		description: 'Vibrant coral reef teeming with life. Organic complexity and dense overlapping structures.',
		tags: ['underwater', 'dense-objects', 'fine-detail', 'photograph', 'nature'],
		query: 'coral reef underwater colorful',
		orientation: 'landscape',
	},
	{
		id: 'flower-bouquet',
		name: 'Flower Bouquet',
		description: 'A lush flower bouquet with overlapping petals. Tests segmentation of overlapping organic shapes.',
		tags: ['flower', 'plant', 'fine-detail', 'overlapping', 'photograph'],
		query: 'flower bouquet colorful',
		orientation: 'portrait',
	},
	{
		id: 'ornate-facade',
		name: 'Ornate Building Facade',
		description: 'An ornate building facade with intricate architectural details and filigree.',
		tags: ['architecture', 'outdoor', 'fine-detail', 'photograph'],
		query: 'ornate building facade architecture detail',
		orientation: 'portrait',
	},
	{
		id: 'food-platter',
		name: 'Food Platter Overhead',
		description: 'An overhead shot of a food platter with many items. Clean boundaries and many distinct objects.',
		tags: ['food', 'indoor', 'dense-objects', 'easy', 'photograph'],
		query: 'food platter overhead table',
		orientation: 'landscape',
	},
	{
		id: 'person-crowd',
		name: 'Person in Crowd',
		description: 'A person in a crowd, partially occluded by others. Tests occlusion handling.',
		tags: ['person', 'urban', 'overlapping', 'occluded', 'photograph'],
		query: 'person crowd people street',
		orientation: 'landscape',
	},
	{
		id: 'motorcycle',
		name: 'Motorcycle',
		description: 'A motorcycle with chrome details and complex shapes. Reflective surfaces challenge segmentation.',
		tags: ['vehicle', 'reflective', 'fine-detail', 'photograph'],
		query: 'motorcycle chrome detail',
		orientation: 'landscape',
	},
	{
		id: 'spider-web',
		name: 'Spider Web with Dew',
		description:
			'A spider web glistening with dew drops. Ultra-fine structures at the extreme end of segmentation difficulty.',
		tags: ['insect', 'thin-structures', 'macro', 'extreme', 'photograph', 'nature'],
		query: 'spider web dew drops macro',
		orientation: 'landscape',
	},
	{
		id: 'tree-canopy',
		name: 'Tree Canopy Looking Up',
		description: 'Looking up through a tree canopy with leaves against sky. Complex organic branching patterns.',
		tags: ['tree', 'nature', 'fine-detail', 'photograph', 'outdoor'],
		query: 'tree canopy looking up leaves sky',
		orientation: 'portrait',
	},
	{
		id: 'jewelry-stand',
		name: 'Jewelry on Stand',
		description: 'Jewelry displayed on a stand with chains and gems. Fine detail and reflective surfaces.',
		tags: ['jewelry', 'studio', 'fine-detail', 'photograph'],
		query: 'jewelry necklace display',
		orientation: 'portrait',
	},
	{
		id: 'salad-bowl',
		name: 'Bowl of Salad',
		description: 'A bowl of salad with mixed textures and overlapping ingredients.',
		tags: ['food', 'indoor', 'overlapping', 'photograph'],
		query: 'salad bowl fresh vegetables',
		orientation: 'landscape',
	},
	{
		id: 'cat-keyboard',
		name: 'Cat on Keyboard',
		description: 'A cat sitting on or near a keyboard. Multiple subjects with different textures.',
		tags: ['animal', 'electronics', 'fur', 'indoor', 'photograph'],
		query: 'cat laptop keyboard',
		orientation: 'landscape',
	},
	{
		id: 'soccer-kick',
		name: 'Soccer Player Mid-Kick',
		description: 'A soccer player captured mid-kick. Motion blur adds segmentation difficulty.',
		tags: ['person', 'outdoor', 'motion-blur', 'photograph'],
		query: 'soccer player kicking ball action',
		orientation: 'landscape',
	},
	{
		id: 'potted-succulent',
		name: 'Potted Succulent',
		description: 'A potted succulent plant in close-up. Clean subject with interesting geometric texture.',
		tags: ['plant', 'macro', 'easy', 'photograph', 'nature'],
		query: 'succulent plant pot close up',
		orientation: 'square',
	},
	{
		id: 'hot-air-balloons',
		name: 'Hot Air Balloons',
		description:
			'Colorful hot air balloons against a clear sky. Clear shapes and vivid colors make this an easy but striking demo.',
		tags: ['vehicle', 'outdoor', 'easy', 'photograph'],
		query: 'hot air balloons colorful sky',
		orientation: 'landscape',
	},
];

interface PexelsPhoto {
	id: number;
	width: number;
	height: number;
	url: string;
	photographer: string;
	photographer_url: string;
	src: {
		original: string;
		large2x: string;
		large: string;
	};
}

interface PexelsSearchResponse {
	photos: PexelsPhoto[];
	total_results: number;
}

interface ManifestImage {
	id: string;
	name: string;
	description: string;
	tags: string[];
	width: number;
	height: number;
	fileSize: number;
	key: string;
	source: {
		photographer: string;
		url: string;
		license: string;
	};
}

async function searchPexels(query: string, orientation?: string): Promise<PexelsPhoto | null> {
	const params = new URLSearchParams({
		query,
		per_page: '1',
		size: 'large',
	});
	if (orientation) params.set('orientation', orientation);

	const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
		headers: { Authorization: PEXELS_API_KEY },
	});

	if (!response.ok) {
		console.error(`  Pexels API error: ${response.status} ${response.statusText}`);
		return null;
	}

	const data: PexelsSearchResponse = await response.json();
	return data.photos[0] ?? null;
}

async function getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
	// Parse JPEG SOF markers to extract dimensions without external dependencies
	const data = new Uint8Array(await Bun.file(filePath).arrayBuffer());
	let offset = 2; // Skip SOI marker
	while (offset < data.length - 1) {
		if (data[offset] !== 0xff) break;
		const marker = data[offset + 1];
		// SOF0-SOF3 markers contain dimensions
		if (marker >= 0xc0 && marker <= 0xc3) {
			const height = (data[offset + 5] << 8) | data[offset + 6];
			const width = (data[offset + 7] << 8) | data[offset + 8];
			return { width, height };
		}
		// Skip this marker segment
		const segLen = (data[offset + 2] << 8) | data[offset + 3];
		offset += 2 + segLen;
	}
	console.warn(`  Could not parse JPEG dimensions for ${filePath}`);
	return { width: 0, height: 0 };
}

async function downloadAndProcess(spec: ImageSpec): Promise<ManifestImage | null> {
	const filename = `${spec.id}.jpg`;
	const filePath = join(DEMOS_DIR, filename);
	const key = `demos/${filename}`;

	if (existsSync(filePath)) {
		console.log(`  already exists: ${spec.id}`);
		const fileSize = Bun.file(filePath).size;
		const { width, height } = await getImageDimensions(filePath);
		// Read cached photo metadata if available
		const metaPath = join(DEMOS_DIR, `${spec.id}.meta.json`);
		let photographer = 'Unknown';
		let sourceUrl = 'https://www.pexels.com';
		if (existsSync(metaPath)) {
			const meta = await Bun.file(metaPath).json();
			photographer = meta.photographer;
			sourceUrl = meta.url;
		}
		return {
			id: spec.id,
			name: spec.name,
			description: spec.description,
			tags: spec.tags,
			width,
			height,
			fileSize,
			key,
			source: { photographer, url: sourceUrl, license: 'pexels' },
		};
	}

	console.log(`  searching: "${spec.query}"...`);
	const photo = await searchPexels(spec.query, spec.orientation);
	if (!photo) {
		console.error(`    no results for ${spec.id}`);
		return null;
	}

	// Download the large2x version (good quality, reasonable size)
	const downloadUrl = `${photo.src.original}?auto=compress&cs=tinysrgb&w=2000`;
	console.log(`  downloading: ${spec.id} (by ${photo.photographer})...`);

	try {
		const response = await fetch(downloadUrl, { redirect: 'follow' });
		if (!response.ok) {
			console.error(`    download failed: ${response.status}`);
			return null;
		}
		const buffer = await response.arrayBuffer();
		await Bun.write(filePath, buffer);

		// Cache photo metadata for re-runs
		await Bun.write(
			join(DEMOS_DIR, `${spec.id}.meta.json`),
			JSON.stringify({
				pexelsId: photo.id,
				photographer: photo.photographer,
				url: photo.url,
			}),
		);

		console.log(`    saved (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
	} catch (err) {
		console.error(`    error downloading ${spec.id}:`, err);
		return null;
	}

	const fileSize = Bun.file(filePath).size;
	const { width, height } = await getImageDimensions(filePath);

	return {
		id: spec.id,
		name: spec.name,
		description: spec.description,
		tags: spec.tags,
		width,
		height,
		fileSize,
		key,
		source: {
			photographer: photo.photographer,
			url: photo.url,
			license: 'pexels',
		},
	};
}

async function main() {
	mkdirSync(DEMOS_DIR, { recursive: true });

	console.log(`Downloading ${IMAGE_SPECS.length} demo images via Pexels API...\n`);

	const results: ManifestImage[] = [];
	for (const spec of IMAGE_SPECS) {
		const result = await downloadAndProcess(spec);
		if (result) {
			results.push(result);
		}
		// Small delay to be polite to the API
		await Bun.sleep(200);
	}

	const manifest = {
		version: 1,
		images: results,
	};

	await Bun.write(MANIFEST_PATH, JSON.stringify(manifest, null, '\t'));
	console.log(`\nManifest written to ${MANIFEST_PATH} (${results.length} images)`);

	if (results.length < IMAGE_SPECS.length) {
		console.log(`\n${IMAGE_SPECS.length - results.length} images failed to download`);
	}

	// Clean up meta files
	console.log('\nDone! Images saved to static/demos/');
	console.log('Manifest saved to static/demo-images.json');
}

main().catch(console.error);
