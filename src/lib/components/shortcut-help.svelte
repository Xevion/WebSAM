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

function formatKey(raw: string): string {
	return raw
		.split('+')
		.map((k) => k.charAt(0).toUpperCase() + k.slice(1))
		.join(' + ');
}

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

const keysWrapper = css({
	display: 'flex',
	gap: '1',
	flexShrink: 0,
});

const kbd = css({
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	minW: '6',
	h: '6',
	px: '1.5',
	fontSize: 'xs',
	fontWeight: 'medium',
	fontFamily: 'mono',
	bg: 'bg.muted',
	color: 'fg.muted',
	borderWidth: '1px',
	borderColor: 'border',
	borderRadius: 'sm',
	lineHeight: '1',
});
</script>

<DialogComponent {open} {onOpenChange} title="Keyboard Shortcuts">
	<div class={list}>
		{#each allShortcuts as shortcut (shortcut.keys)}
			<div class={row}>
				<span class={descriptionStyle}>{shortcut.description}</span>
				<span class={keysWrapper}>
					{#each formatKey(shortcut.keys).split(' + ') as part, i (part)}
						{#if i > 0}
							<span class={css({ fontSize: 'xs', color: 'fg.subtle', alignSelf: 'center' })}>+</span>
						{/if}
						<kbd class={kbd}>{part}</kbd>
					{/each}
				</span>
			</div>
		{/each}
	</div>
</DialogComponent>
