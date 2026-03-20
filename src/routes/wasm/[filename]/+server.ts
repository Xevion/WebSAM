import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

const ALLOWED_FILES = new Set([
	'ort-wasm-simd-threaded.wasm',
	'ort-wasm-simd-threaded.asyncify.wasm',
	'ort-wasm-simd-threaded.jsep.wasm',
	'ort-wasm-simd-threaded.jspi.wasm',
]);

export const GET: RequestHandler = async ({ params, platform }) => {
	const env = platform?.env;
	if (!env) throw error(503, 'Platform bindings unavailable');

	const { filename } = params;
	if (!filename || !ALLOWED_FILES.has(filename)) {
		throw error(404, 'Not found');
	}

	const object = await env.MODELS.get(`wasm/${filename}`);
	if (!object) throw error(404, 'WASM file not found in R2');

	return new Response(object.body, {
		headers: {
			'Content-Type': 'application/wasm',
			'Cache-Control': 'public, max-age=31536000, immutable',
			'Content-Length': String(object.size),
		},
	});
};
