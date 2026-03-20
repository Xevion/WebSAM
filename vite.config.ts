import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

/**
 * Prevents Vite from bundling ORT WASM files as static assets.
 * Vite detects `new URL('...wasm', import.meta.url)` patterns and copies the
 * referenced files into the build output. For ORT, this produces 25+ MB WASM
 * files that exceed Cloudflare Workers' asset size limit.
 *
 * This plugin rewrites those URL references to data URIs during transform,
 * so Vite never emits the WASM files. At runtime, ORT uses
 * `ort.env.wasm.wasmPaths` (set in session.ts) to load WASM from R2 instead.
 */
function stripOrtWasm(): Plugin {
	return {
		name: 'strip-ort-wasm',
		enforce: 'pre',
		apply: 'build',
		transform(code, id) {
			if (!id.includes('onnxruntime-web')) return;
			if (id.includes('.wasm')) return;
			const replaced = code.replace(
				/new URL\("ort-wasm[^"]*\.wasm",import\.meta\.url\)/g,
				'new URL("data:,")',
			);
			if (replaced !== code) return replaced;
		},
	};
}

export default defineConfig({
	clearScreen: false,
	plugins: [sveltekit(), devtoolsJson(), stripOrtWasm()],
	optimizeDeps: {
		exclude: ['onnxruntime-web'],
	},
	worker: {
		format: 'es',
		plugins: () => [stripOrtWasm()],
	},
	server: {
		host: true,
		allowedHosts: ['lumine'],
		fs: { allow: ['styled-system'] },
	},
});
