<script lang="ts">
import { Dialog } from '@ark-ui/svelte/dialog';
import { Portal } from '@ark-ui/svelte/portal';
import X from '@lucide/svelte/icons/x';
import { css } from 'styled-system/css';
import type { Snippet } from 'svelte';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	maxWidth?: string;
	height?: string;
	children: Snippet;
}

const { open, onOpenChange, title, description, maxWidth = '28rem', height, children }: Props = $props();

const backdrop = css({
	position: 'fixed',
	inset: '0',
	bg: 'oklch(0 0 0 / 50%)',
	zIndex: '50',
	_open: { animation: 'fade-in 150ms ease-out' },
	_closed: { animation: 'fade-out 100ms ease-in' },
});

const positioner = css({
	position: 'fixed',
	inset: '0',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	// Padding keeps the dialog off the viewport edges; overflow is a safety net
	// for viewports shorter than even the height-capped content.
	p: '4',
	overflowY: 'auto',
	zIndex: '50',
});

const content = css({
	display: 'flex',
	flexDirection: 'column',
	bg: 'bg',
	borderWidth: '1px',
	borderColor: 'border',
	borderRadius: 'xl',
	boxShadow: 'lg',
	w: 'full',
	// Cap to the (padded) viewport so tall content scrolls internally rather
	// than overflowing past the top edge where it can't be reached.
	maxH: 'full',
	overflow: 'hidden',
	_open: { animation: 'slide-fade-in 200ms ease-out' },
});

const header = css({
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'start',
	flexShrink: 0,
	px: '6',
	pt: '6',
	pb: '4',
});

const body = css({
	flex: '1',
	minH: '0',
	overflowY: 'auto',
	px: '6',
	pb: '6',
	scrollbarWidth: 'thin',
	scrollbarColor: 'var(--colors-border) transparent',
	'&::-webkit-scrollbar': { width: '6px' },
	'&::-webkit-scrollbar-track': { background: 'transparent' },
	'&::-webkit-scrollbar-thumb': { background: 'var(--colors-border)', borderRadius: '9999px' },
	'&::-webkit-scrollbar-thumb:hover': { background: 'var(--colors-fg-subtle)' },
});

const titleStyle = css({
	fontSize: 'lg',
	fontWeight: 'semibold',
});

const descStyle = css({
	fontSize: 'sm',
	color: 'fg.muted',
	mt: '1',
});

const closeBtn = css({
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	w: '8',
	h: '8',
	borderRadius: 'md',
	cursor: 'pointer',
	border: 'none',
	bg: 'transparent',
	color: 'fg.muted',
	_hover: { bg: 'bg.muted', color: 'fg' },
});
</script>

<Dialog.Root {open} onOpenChange={(details) => onOpenChange(details.open)}>
	<Portal>
		<Dialog.Backdrop class={backdrop} />
		<Dialog.Positioner class={positioner}>
			<Dialog.Content class={content} style="max-width: {maxWidth}{height ? `; height: ${height}` : ''}">
				<div class={header}>
					<div>
						<Dialog.Title class={titleStyle}>{title}</Dialog.Title>
						{#if description}
							<Dialog.Description class={descStyle}>{description}</Dialog.Description>
						{/if}
					</div>
					<Dialog.CloseTrigger class={closeBtn}>
						<X size={16} />
					</Dialog.CloseTrigger>
				</div>
				<div class={body}>
					{@render children()}
				</div>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog.Root>
