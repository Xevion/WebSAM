import type { DemoImage, DemoManifest, DemoCollection } from './types';
import { DEMO_COLLECTIONS } from './collections';
import { SvelteSet } from 'svelte/reactivity';
import { SvelteMap } from 'svelte/reactivity';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const CDN_HOST: string = import.meta.env.VITE_CDN_HOST ?? '';

function createDemoImageStore() {
	let images = $state<DemoImage[]>([]);
	let loaded = $state(false);
	let error = $state<string | null>(null);
	const activeTags = new SvelteSet<string>();
	let activeCollection = $state<string | null>(null);

	return {
		get images() {
			return images;
		},
		get loaded() {
			return loaded;
		},
		get error() {
			return error;
		},
		get activeTags() {
			return activeTags;
		},
		get activeCollection() {
			return activeCollection;
		},
		get collections(): DemoCollection[] {
			return DEMO_COLLECTIONS;
		},

		async load(): Promise<void> {
			if (loaded) return;
			try {
				const res = await fetch('/demo-images.json');
				if (!res.ok) throw new Error(`Failed to load demo images: ${res.status}`);
				const manifest = (await res.json()) as DemoManifest;
				images = manifest.images;
				loaded = true;
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to load demo images';
			}
		},

		get filtered(): DemoImage[] {
			let result = images;

			if (activeCollection) {
				const collection = DEMO_COLLECTIONS.find((c) => c.id === activeCollection);
				if (collection) {
					const f = collection.filter;
					if (f.type === 'ids') {
						const idSet = new Set(f.ids);
						result = result.filter((img) => idSet.has(img.id));
					} else {
						const tagSet = new Set(f.tags);
						if (f.mode === 'any') {
							result = result.filter((img) => img.tags.some((t) => tagSet.has(t)));
						} else {
							result = result.filter((img) => f.tags.every((t) => img.tags.includes(t)));
						}
					}
				}
			}

			if (activeTags.size > 0) {
				result = result.filter((img) => [...activeTags].every((tag) => img.tags.includes(tag)));
			}

			return result;
		},

		get availableTags(): SvelteMap<string, number> {
			const counts = new SvelteMap<string, number>();
			for (const img of this.filtered) {
				for (const tag of img.tags) {
					counts.set(tag, (counts.get(tag) ?? 0) + 1);
				}
			}
			return counts;
		},

		get heroImages(): DemoImage[] {
			const showcase = DEMO_COLLECTIONS.find((c) => c.id === 'showcase');
			if (showcase?.filter.type !== 'ids') return images.slice(0, 12);
			const idSet = new Set(showcase.filter.ids);
			return images.filter((img) => idSet.has(img.id)).slice(0, 12);
		},

		toggleTag(tag: string): void {
			if (activeTags.has(tag)) {
				activeTags.delete(tag);
			} else {
				activeTags.add(tag);
			}
		},

		clearTags(): void {
			activeTags.clear();
		},

		setCollection(id: string | null): void {
			activeCollection = id;
			activeTags.clear();
		},

		thumbnailUrl(image: DemoImage, width: number): string {
			if (!CDN_HOST) return `/${image.key}`;
			return `${CDN_HOST}/cdn-cgi/image/width=${width},format=webp,quality=80/${image.key}`;
		},

		fullUrl(image: DemoImage): string {
			if (!CDN_HOST) return `/${image.key}`;
			return `${CDN_HOST}/cdn-cgi/image/format=webp,quality=90/${image.key}`;
		},
	};
}

export const demoImageStore = createDemoImageStore();
