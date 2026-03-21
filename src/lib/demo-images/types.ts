export interface DemoImageSource {
	photographer: string;
	url: string;
	license: 'unsplash' | 'pexels' | 'pixabay' | 'cc0' | 'cc-by';
}

export interface DemoImage {
	id: string;
	name: string;
	description: string;
	tags: string[];
	width: number;
	height: number;
	fileSize: number;
	key: string;
	source: DemoImageSource;
}

export interface DemoCollection {
	id: string;
	name: string;
	description: string;
	filter: { type: 'tags'; tags: string[]; mode: 'any' | 'all' } | { type: 'ids'; ids: string[] };
}

export interface DemoManifest {
	images: DemoImage[];
	version: number;
}
