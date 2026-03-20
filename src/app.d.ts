declare global {
	namespace App {
		interface Platform {
			env: {
				MODELS: R2Bucket;
				R2_ACCESS_KEY_ID: string;
				R2_SECRET_ACCESS_KEY: string;
				R2_ACCOUNT_ID: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

interface ImportMetaEnv {
	readonly VITE_CDN_HOST: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export {};
