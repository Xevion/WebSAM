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
	children: Snippet;
}

const { open, onOpenChange, title, children }: Props = $props();

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
	zIndex: '50',
	display: 'flex',
});

const content = css({
	bg: 'bg',
	borderRightWidth: '1px',
	borderColor: 'border',
	boxShadow: 'lg',
	w: '18rem',
	maxW: '85vw',
	h: 'full',
	overflowY: 'auto',
	display: 'flex',
	flexDirection: 'column',
	_open: { animation: 'slide-in-left 200ms ease-out' },
	_closed: { animation: 'slide-out-left 150ms ease-in' },
});

const header = css({
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
	p: '4',
	borderBottomWidth: '1px',
	borderColor: 'border',
	flexShrink: 0,
});

const titleStyle = css({
	fontSize: 'lg',
	fontWeight: 'semibold',
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

const body = css({
	flex: '1',
	overflowY: 'auto',
	p: '4',
	display: 'flex',
	flexDirection: 'column',
	gap: '6',
});
</script>

<Dialog.Root {open} onOpenChange={(details) => onOpenChange(details.open)}>
	<Portal>
		<Dialog.Backdrop class={backdrop} />
		<Dialog.Positioner class={positioner}>
			<Dialog.Content class={content}>
				<div class={header}>
					<Dialog.Title class={titleStyle}>{title}</Dialog.Title>
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
