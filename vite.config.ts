import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { existsSync, createReadStream, statSync } from 'node:fs';
import { lookup } from 'mrmime';

/**
 * Serves files from the local models/ directory at /models/ URL path
 * during development. These files are NOT included in the production build.
 */
function serveModels(): Plugin {
	return {
		name: 'serve-models',
		configureServer(server) {
			const modelsDir = resolve(process.cwd(), 'models');
			server.middlewares.use((req, res, next) => {
				if (!req.url?.startsWith('/models/')) return next();
				const filePath = resolve(join(modelsDir, decodeURIComponent(req.url.slice('/models'.length))));
				if (!filePath.startsWith(modelsDir)) return next();
				if (!existsSync(filePath)) return next();
				const stat = statSync(filePath);
				const mime = lookup(filePath) ?? 'application/octet-stream';
				res.setHeader('Content-Type', mime);
				res.setHeader('Content-Length', stat.size);
				res.setHeader('Access-Control-Allow-Origin', '*');
				createReadStream(filePath).pipe(res);
			});
		},
	};
}

export default defineConfig({
	clearScreen: false,
	plugins: [sveltekit(), devtoolsJson(), serveModels()],
	optimizeDeps: {
		exclude: ['onnxruntime-web'],
	},
	worker: {
		format: 'es',
	},
	server: {
		fs: { allow: ['styled-system', 'models'] },
	},
});
