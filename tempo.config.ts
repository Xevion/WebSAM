import { defineConfig, runners } from '@xevion/tempo';

export default defineConfig({
	subsystems: {
		app: {
			aliases: ['a'],
			commands: {
				'format-check': 'bun run format:check',
				'format-apply': 'bun run format',
				lint: 'bun run lint',
				'lint-fix': 'bun run lint:fix',
				'type-check': 'bun run check',
			},
			autoFix: { 'format-check': 'format-apply' },
		},
	},
	commands: {
		check: runners.check({
			autoFixStrategy: 'fix-first',
			exclude: ['app:format-apply', 'app:lint-fix'],
		}),
		fmt: runners.sequential('format-apply', { description: 'Format source files with Biome' }),
		lint: runners.sequential('lint', { description: 'Lint with ESLint' }),
		'pre-commit': runners.preCommit(),
		dev: {
			description: 'Start Vite dev server',
			run: async (ctx) => {
				ctx.run('bun run dev');
				return 0;
			},
		},
		build: {
			description: 'Build for production',
			run: async (ctx) => {
				ctx.run('bun run build');
				return 0;
			},
		},
		deploy: {
			description: 'Deploy to Cloudflare Workers',
			run: async (ctx) => {
				ctx.run('wrangler deploy');
				return 0;
			},
		},
		upload: {
			description: 'Upload ONNX models, WASM files, and demo images to R2',
			parameters: ['--', '[args...]'],
			run: async (ctx) => {
				ctx.run(['bun', 'run', 'scripts/upload.ts', ...ctx.passthrough]);
				return 0;
			},
		},
		download: {
			description: 'Download demo images from Pexels and generate manifest',
			parameters: ['--', '[args...]'],
			run: async (ctx) => {
				ctx.run(['bun', 'run', 'scripts/download.ts', ...ctx.passthrough]);
				return 0;
			},
		},
	},
});
