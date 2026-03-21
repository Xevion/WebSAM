import type { RequestHandler } from '@sveltejs/kit';
import { AwsClient } from 'aws4fetch';
import { error, json } from '@sveltejs/kit';

const EXPIRES_SECONDS = 3600;
const BUCKET_NAME = 'websam';

export const GET: RequestHandler = async ({ url, platform }) => {
	const env = platform?.env;
	if (!env) throw error(503, 'Platform bindings unavailable');

	const key = url.searchParams.get('key');
	if (!key) throw error(400, 'Missing key parameter');

	// Validate the key looks like a model path
	if (!key.startsWith('models/') || key.includes('..')) {
		throw error(400, 'Invalid key');
	}

	const client = new AwsClient({
		accessKeyId: env.R2_ACCESS_KEY_ID,
		secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		service: 's3',
		region: 'auto',
	});

	const objectUrl = new URL(
		`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}/${key}`,
	);
	objectUrl.searchParams.set('X-Amz-Expires', String(EXPIRES_SECONDS));

	const signed = await client.sign(new Request(objectUrl.toString()), {
		aws: { signQuery: true },
	});

	return json({ url: signed.url });
};
