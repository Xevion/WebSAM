<script lang="ts">
import DialogComponent from '$lib/components/ui/dialog.svelte';
import TabsComponent from '$lib/components/ui/tabs.svelte';
import { demoImageStore } from '$lib/demo-images/store.svelte';
import { loadDemoImage } from '$lib/demo-images/loader';
import { TAG_GROUPS, DEMO_COLLECTIONS } from '$lib/demo-images/collections';
import ImageOff from '@lucide/svelte/icons/image-off';
import { css, cx } from 'styled-system/css';
import { onMount } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const { open, onOpenChange }: Props = $props();

let loading = $state<string | null>(null);
let tagsExpanded = $state(false);
let failedImages = new SvelteSet<string>();

function handleImgError(id: string) {
	failedImages.add(id);
}

onMount(() => {
	void demoImageStore.load();
});

async function handleSelect(image: (typeof demoImageStore.filtered)[number]) {
	loading = image.id;
	try {
		await loadDemoImage(image);
		onOpenChange(false);
	} catch (err) {
		console.error('Failed to load demo image:', err);
	} finally {
		loading = null;
	}
}

const ALL_COLLECTIONS_VALUE = 'all';

const collectionTabs = [
	{ value: ALL_COLLECTIONS_VALUE, label: 'All' },
	...DEMO_COLLECTIONS.map((collection) => ({
		value: collection.id,
		label: collection.name,
		description: collection.description,
	})),
];

function formatSize(bytes: number): string {
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const collectionsRow = css({
	mb: '3',
});

const tagSection = css({
	mb: '3',
	borderWidth: '1px',
	borderColor: 'border',
	borderRadius: 'lg',
	overflow: 'hidden',
});

const tagHeader = css({
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
	px: '3',
	py: '2',
	cursor: 'pointer',
	bg: 'bg.subtle',
	fontSize: 'sm',
	fontWeight: 'medium',
	color: 'fg.muted',
	border: 'none',
	w: 'full',
	_hover: { color: 'fg' },
});

const tagGroupLabel = css({
	fontSize: 'xs',
	fontWeight: 'semibold',
	color: 'fg.subtle',
	textTransform: 'uppercase',
	letterSpacing: '0.05em',
	mb: '1.5',
	mt: '3',
	_first: { mt: '0' },
});

const tagChipsWrap = css({
	display: 'flex',
	flexWrap: 'wrap',
	gap: '1.5',
	px: '3',
	py: '2',
	// Cap the expanded tag list so the ~85 chips can't balloon the dialog;
	// scroll within the bordered box instead.
	maxH: '16rem',
	overflowY: 'auto',
	scrollbarWidth: 'thin',
	scrollbarColor: 'var(--colors-border) transparent',
	'&::-webkit-scrollbar': { width: '6px' },
	'&::-webkit-scrollbar-track': { background: 'transparent' },
	'&::-webkit-scrollbar-thumb': { background: 'var(--colors-border)', borderRadius: '9999px' },
	'&::-webkit-scrollbar-thumb:hover': { background: 'var(--colors-fg-subtle)' },
});

const tagChip = css({
	px: '2',
	py: '0.5',
	borderRadius: 'full',
	fontSize: 'xs',
	cursor: 'pointer',
	border: '1px solid',
	borderColor: 'border',
	bg: 'transparent',
	color: 'fg.muted',
	transition: 'all 100ms',
	_hover: { borderColor: 'primary', color: 'primary' },
});

const tagChipActive = css({
	bg: 'primary',
	color: 'white',
	borderColor: 'primary',
	_hover: { bg: 'primary', color: 'white' },
});

const tagChipDisabled = css({
	opacity: 0.3,
	pointerEvents: 'none',
});

const grid = css({
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))',
	gap: '3',
});

const card = css({
	borderRadius: 'lg',
	overflow: 'hidden',
	cursor: 'pointer',
	border: '1px solid',
	borderColor: 'border',
	bg: 'bg',
	transition: 'all 150ms',
	_hover: { borderColor: 'primary', boxShadow: 'sm' },
});

const cardLoading = css({
	opacity: 0.5,
	pointerEvents: 'none',
});

const cardThumb = css({
	w: 'full',
	aspectRatio: '4/3',
	objectFit: 'cover',
	bg: 'bg.muted',
	imageRendering: 'auto',
});

const cardError = css({
	w: 'full',
	aspectRatio: '4/3',
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '1',
	bg: 'bg.muted',
	color: 'danger.subtleFg',
	fontSize: 'xs',
});

const cardBody = css({
	p: '2',
});

const cardName = css({
	fontSize: 'sm',
	fontWeight: 'medium',
	lineClamp: 1,
});

const cardMeta = css({
	fontSize: 'xs',
	color: 'fg.subtle',
	mt: '0.5',
});

const resultCount = css({
	fontSize: 'sm',
	color: 'fg.muted',
	mb: '2',
});

const noResults = css({
	textAlign: 'center',
	py: '8',
	color: 'fg.subtle',
	fontSize: 'sm',
});
</script>

<DialogComponent
	{open}
	{onOpenChange}
	title="Demo Image Gallery"
	description="Choose an image to try WebSAM's segmentation"
	maxWidth="56rem"
	height="min(85vh, 44rem)"
>
	<!-- Collection presets -->
	<TabsComponent
		items={collectionTabs}
		value={demoImageStore.activeCollection ?? ALL_COLLECTIONS_VALUE}
		onValueChange={(value: string) => demoImageStore.setCollection(value === ALL_COLLECTIONS_VALUE ? null : value)}
		class={collectionsRow}
	/>

	<!-- Tag filter (collapsible) -->
	<div class={tagSection}>
		<button type="button" class={tagHeader} onclick={() => { tagsExpanded = !tagsExpanded; }}>
			<span>Filter by tags {demoImageStore.activeTags.size > 0 ? `(${demoImageStore.activeTags.size} active)` : ''}</span>
			<span>{tagsExpanded ? '\u25B2' : '\u25BC'}</span>
		</button>
		{#if tagsExpanded}
			<div class={tagChipsWrap}>
				{#each TAG_GROUPS as group (group.label)}
					<div style="width: 100%;">
						<div class={tagGroupLabel}>{group.label}</div>
						<div class={css({ display: 'flex', flexWrap: 'wrap', gap: '1.5' })}>
							{#each group.tags as tag (tag)}
								{@const count = demoImageStore.availableTags.get(tag) ?? 0}
								{@const isActive = demoImageStore.activeTags.has(tag)}
								<button
									type="button"
									class={cx(tagChip, isActive ? tagChipActive : '', count === 0 && !isActive ? tagChipDisabled : '')}
									onclick={() => demoImageStore.toggleTag(tag)}
									disabled={count === 0 && !isActive}
								>
									{tag} {count > 0 ? `(${count})` : ''}
								</button>
							{/each}
						</div>
					</div>
				{/each}
				{#if demoImageStore.activeTags.size > 0}
					<button
						type="button"
						class={cx(tagChip, css({ color: 'danger.subtleFg' }))}
						onclick={() => demoImageStore.clearTags()}
					>
						Clear filters
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Result count -->
	<div class={resultCount}>
		{demoImageStore.filtered.length} image{demoImageStore.filtered.length === 1 ? '' : 's'}
	</div>

	<!-- Image grid -->
	<div class={grid}>
		{#each demoImageStore.filtered as image (image.id)}
			<button
				type="button"
				class={cx(card, loading === image.id ? cardLoading : '')}
				onclick={() => handleSelect(image)}
				disabled={loading !== null}
			>
				{#if failedImages.has(image.id) || !demoImageStore.thumbnailUrl(image, 320)}
					<div class={cardError}>
						<ImageOff size={24} />
						<span>Failed to load</span>
					</div>
				{:else}
					<img
						src={demoImageStore.thumbnailUrl(image, 320)}
						alt={image.name}
						class={cardThumb}
						loading="lazy"
						width={image.width}
						height={image.height}
						onerror={() => handleImgError(image.id)}
					/>
				{/if}
				<div class={cardBody}>
					<div class={cardName}>{image.name}</div>
					<div class={cardMeta}>
						{image.width}&times;{image.height} &middot; {formatSize(image.fileSize)}
					</div>
				</div>
			</button>
		{/each}
	</div>

	{#if demoImageStore.filtered.length === 0}
		<div class={noResults}>No images match the current filters.</div>
	{/if}
</DialogComponent>
