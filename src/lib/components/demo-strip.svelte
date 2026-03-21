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

function handleImgError(id: string) {
	failedImages.add(id);
}

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
});

const thumbBtn = css({
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

const thumbError = css({
	w: 'full',
	h: 'full',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	color: 'fg.subtle',
	bg: 'bg.muted',
	borderRadius: 'lg',
	border: '1px solid',
	borderColor: 'border',
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

{#if demoImageStore.loaded && demoImageStore.heroImages.length > 0}
	<div class={wrapper}>
		<div class={header}>
			<span class={label}>Or try a demo image</span>
			<button type="button" class={browseLink} onclick={onBrowseAll}>
				Browse all
			</button>
		</div>
		<div class={strip}>
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
								<div class={thumbError}>
									<ImageOff size={20} />
								</div>
							{:else}
								<img
									src={demoImageStore.thumbnailUrl(image, 128)}
									alt={image.name}
									class={thumbImg}
									loading="lazy"
									onerror={() => handleImgError(image.id)}
								/>
							{/if}
						</button>
					{/snippet}
				</Tooltip>
			{/each}
		</div>
	</div>
{/if}
