import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	clearScreen: false,
	plugins: [sveltekit(), devtoolsJson()],
	server: {
		fs: { allow: ['styled-system'] },
	},
});
