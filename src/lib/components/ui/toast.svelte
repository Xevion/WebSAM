<script lang="ts">
import { Toaster, Toast } from '@ark-ui/svelte/toast';
import { toaster } from '$lib/stores/toast.svelte';
import X from '@lucide/svelte/icons/x';
import { css } from 'styled-system/css';

const root = css({
	bg: 'bg',
	borderWidth: '1px',
	borderColor: 'border',
	borderRadius: 'md',
	shadow: 'md',
	px: '4',
	py: '3',
	minW: '16rem',
	maxW: '22rem',
	display: 'flex',
	alignItems: 'flex-start',
	gap: '3',
	borderLeftWidth: '3px',
	'&[data-type="success"]': { borderLeftColor: 'success.fg' },
	'&[data-type="error"]': { borderLeftColor: 'danger' },
	'&[data-type="info"]': { borderLeftColor: 'primary' },
	'&[data-type="loading"]': { borderLeftColor: 'fg.muted' },
	_open: { animation: 'fade-in 150ms ease-out' },
	_closed: { animation: 'fade-out 100ms ease-in' },
});

const body = css({
	flex: '1',
	minW: '0',
});

const titleStyle = css({
	fontSize: 'sm',
	fontWeight: 'medium',
	color: 'fg',
});

const descriptionStyle = css({
	fontSize: 'sm',
	color: 'fg.muted',
	mt: '0',
});

const closeTrigger = css({
	flexShrink: 0,
	color: 'fg.muted',
	cursor: 'pointer',
	bg: 'transparent',
	border: 'none',
	p: '0',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	borderRadius: 'sm',
	_hover: { color: 'fg' },
});
</script>

<Toaster {toaster}>
	{#snippet children(toast)}
		{@const t = toast()}
		<Toast.Root class={root}>
			<div class={body}>
				{#if t.title}
					<Toast.Title class={titleStyle}>{t.title}</Toast.Title>
				{/if}
				{#if t.description}
					<Toast.Description class={descriptionStyle}>{t.description}</Toast.Description>
				{/if}
			</div>
			{#if t.closable !== false}
				<Toast.CloseTrigger class={closeTrigger}>
					<X size={14} />
				</Toast.CloseTrigger>
			{/if}
		</Toast.Root>
	{/snippet}
</Toaster>
