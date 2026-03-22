<script lang="ts">
import { demoImageStore } from '$lib/demo-images/store.svelte';
import { loadDemoImage } from '$lib/demo-images/loader';
import Tooltip from '$lib/components/ui/tooltip.svelte';
import ImageOff from '@lucide/svelte/icons/image-off';
import { css, cx } from 'styled-system/css';
import { onMount } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import type { HTMLAttributes } from 'svelte/elements';

type TooltipProps = (p?: Record<string, unknown>) => HTMLAttributes<HTMLElement>;

interface Props {
	onBrowseAll: () => void;
}

const { onBrowseAll }: Props = $props();

let loading = $state<string | null>(null);
let failedImages = new SvelteSet<string>();
let loadedImages = new SvelteSet<string>();

function handleImgError(id: string) {
	failedImages.add(id);
}

function handleImgLoad(id: string) {
	loadedImages.add(id);
}

const SKELETON_COUNT = 6;

onMount(() => {
	void demoImageStore.load();
});

async function handleSelect(image: (typeof demoImageStore.heroImages)[number]) {
	loading = image.id;
	try {
		await loadDemoImage(image);
	} catch (err) {
		console.error('Failed to load demo image:', err);
	} finally {
		loading = null;
	}
}

const strip = css({
	display: 'flex',
	gap: '2',
	overflowX: 'auto',
	py: '2',
	px: '1',
	scrollbarWidth: 'thin',
	scrollbarColor: 'var(--colors-border) transparent',
	'&::-webkit-scrollbar': { height: '6px' },
	'&::-webkit-scrollbar-track': { background: 'transparent' },
	'&::-webkit-scrollbar-thumb': { background: 'var(--colors-border)', borderRadius: '9999px' },
	'&::-webkit-scrollbar-thumb:hover': { background: 'var(--colors-fg-subtle)' },
	'&::-webkit-scrollbar-button': { display: 'none' },
});

const thumbBtn = css({
	position: 'relative',
	flexShrink: 0,
	w: '28',
	h: '20',
	borderRadius: 'lg',
	overflow: 'hidden',
	cursor: 'pointer',
	border: '2px solid transparent',
	transition: 'all 150ms',
	bg: 'bg.muted',
	_hover: { borderColor: 'primary', transform: 'scale(1.05)' },
});

const thumbLoading = css({
	opacity: 0.5,
	pointerEvents: 'none',
});

const thumbImg = css({
	w: 'full',
	h: 'full',
	objectFit: 'cover',
	imageRendering: 'auto',
});

const wrapper = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '2',
	w: 'full',
});

const header = css({
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
});

const label = css({
	fontSize: 'xs',
	color: 'fg.subtle',
	fontWeight: 'medium',
	textTransform: 'uppercase',
	letterSpacing: '0.05em',
});

const thumbPlaceholder = css({
	position: 'absolute',
	inset: 0,
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	color: 'fg.subtle',
	bg: 'bg.muted',
});

const skeleton = css({
	animation: 'pulse',
});

const skeletonThumb = css({
	flexShrink: 0,
	w: '28',
	h: '20',
	borderRadius: 'lg',
	bg: 'bg.muted',
	border: '1px solid',
	borderColor: 'border',
	animation: 'pulse',
});

const browseLink = css({
	fontSize: 'xs',
	color: 'primary',
	cursor: 'pointer',
	bg: 'transparent',
	border: 'none',
	_hover: { textDecoration: 'underline' },
});
</script>

<div class={wrapper}>
	<div class={header}>
		<span class={label}>Or try a demo image</span>
		{#if demoImageStore.loaded}
			<button type="button" class={browseLink} onclick={onBrowseAll}>
				Browse all
			</button>
		{/if}
	</div>
	<div class={strip}>
		{#if !demoImageStore.loaded}
			{#each { length: SKELETON_COUNT } as _, i (i)}
				<div class={skeletonThumb}></div>
			{/each}
		{:else}
			{#each demoImageStore.heroImages as image (image.id)}
				<Tooltip content={image.name}>
					{#snippet children(props: TooltipProps)}
						<button
							type="button"
							{...props?.()}
							class={cx(thumbBtn, loading === image.id ? thumbLoading : '')}
							onclick={() => handleSelect(image)}
							disabled={loading !== null}
						>
							{#if failedImages.has(image.id) || !demoImageStore.thumbnailUrl(image, 128)}
								<div class={thumbPlaceholder}>
									<ImageOff size={20} />
								</div>
							{:else}
								{#if !loadedImages.has(image.id)}
									<div class={cx(thumbPlaceholder, skeleton)}></div>
								{/if}
								<img
									src={demoImageStore.thumbnailUrl(image, 128)}
									alt={image.name}
									class={thumbImg}
									style:opacity={loadedImages.has(image.id) ? 1 : 0}
									onload={() => handleImgLoad(image.id)}
									onerror={() => handleImgError(image.id)}
								/>
							{/if}
						</button>
					{/snippet}
				</Tooltip>
			{/each}
		{/if}
	</div>
</div>
