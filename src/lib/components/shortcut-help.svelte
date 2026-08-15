<script lang="ts">
import DialogComponent from '$lib/components/ui/dialog.svelte';
import { SHORTCUTS } from '$lib/stores/shortcuts.svelte';
import { css } from 'styled-system/css';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const { open, onOpenChange }: Props = $props();

const allShortcuts = SHORTCUTS;

const list = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '2',
});

const row = css({
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
	py: '1.5',
	px: '2',
	borderRadius: 'md',
	_even: { bg: 'bg.subtle' },
});

const descriptionStyle = css({
	fontSize: 'sm',
	color: 'fg',
});

const kbd = css({
	display: 'inline-flex',
	alignItems: 'center',
	gap: '1',
	flexShrink: 0,
	px: '2.5',
	py: '1',
	fontSize: 'xs',
	fontWeight: 'bold',
	fontFamily: 'mono',
	letterSpacing: 'wide',
	textTransform: 'uppercase',
	color: 'fg',
	bg: 'bg.muted',
	borderWidth: '1px',
	borderColor: 'border.strong',
	borderBottomWidth: '2px',
	borderRadius: 'md',
	lineHeight: '1',
	boxShadow: 'inset 0 1px 0 0 rgb(255 255 255 / 0.15), 0 1px 0 0 rgb(0 0 0 / 0.2)',
});

const sep = css({
	color: 'fg.subtle',
	fontWeight: 'medium',
});
</script>

<DialogComponent {open} {onOpenChange} title="Keyboard Shortcuts">
	<div class={list}>
		{#each allShortcuts as shortcut (shortcut.keys)}
			<div class={row}>
				<span class={descriptionStyle}>{shortcut.description}</span>
				<kbd class={kbd}>
					{#each shortcut.keys.split('+') as part, i (part)}
						{#if i > 0}<span class={sep}>+</span>{/if}
						<span>{part}</span>
					{/each}
				</kbd>
			</div>
		{/each}
	</div>
</DialogComponent>
