import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

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
			const replaced = code.replace(/new URL\("ort-wasm[^"]*\.wasm",import\.meta\.url\)/g, 'new URL("data:,")');
			if (replaced !== code) return replaced;
		},
	};
}

/**
 * Copies ORT's .mjs glue files into the build output at /wasm/*.mjs.
 * These are small (24-48 KB) JS files that ORT loads alongside the .wasm files.
 * The .wasm files themselves are served from R2, but the .mjs files are small
 * enough to include as static assets.
 */
function copyOrtGlue(): Plugin {
	return {
		name: 'copy-ort-glue',
		apply: 'build',
		generateBundle() {
			const distDir = resolve('node_modules/onnxruntime-web/dist');
			const mjsFiles = readdirSync(distDir).filter(
				(f) => f.startsWith('ort-wasm-simd-threaded') && f.endsWith('.mjs'),
			);
			for (const file of mjsFiles) {
				this.emitFile({
					type: 'asset',
					fileName: `wasm/${file}`,
					source: readFileSync(resolve(distDir, file)),
				});
			}
		},
	};
}

export default defineConfig({
	clearScreen: false,
	plugins: [sveltekit(), devtoolsJson(), stripOrtWasm(), copyOrtGlue()],
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
