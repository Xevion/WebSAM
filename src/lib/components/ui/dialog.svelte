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
	children: Snippet;
}

const { open, onOpenChange, title, description, maxWidth = '28rem', children }: Props = $props();

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
	zIndex: '50',
});

const content = css({
	bg: 'bg',
	borderWidth: '1px',
	borderColor: 'border',
	borderRadius: 'xl',
	boxShadow: 'lg',
	p: '6',
	w: 'full',
	mx: '4',
	_open: { animation: 'slide-fade-in 200ms ease-out' },
});

const header = css({
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'start',
	mb: '4',
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
			<Dialog.Content class={content} style="max-width: {maxWidth}">
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
				{@render children()}
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog.Root>
