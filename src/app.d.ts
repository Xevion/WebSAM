declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

interface ImportMetaEnv {
	readonly VITE_CDN_HOST: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export {};
