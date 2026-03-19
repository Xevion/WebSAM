<script lang="ts">
import { ToggleGroup } from '@ark-ui/svelte/toggle-group';
import { css } from 'styled-system/css';
import type { Snippet } from 'svelte';

interface ToggleItem {
	value: string;
	label: string;
	icon?: Snippet;
}

interface Props {
	items: ToggleItem[];
	value: string[];
	onValueChange: (value: string[]) => void;
	multiple?: boolean;
	class?: string;
}

const { items, value, onValueChange, multiple = false, class: className }: Props = $props();

const root = css({
	display: 'inline-flex',
	gap: '1',
	bg: 'bg.muted',
	borderRadius: 'lg',
	p: '1',
});

const item = css({
	display: 'inline-flex',
	alignItems: 'center',
	gap: '1.5',
	px: '3',
	py: '1.5',
	fontSize: 'sm',
	fontWeight: 'medium',
	color: 'fg.muted',
	cursor: 'pointer',
	border: 'none',
	bg: 'transparent',
	borderRadius: 'md',
	transition: 'all 150ms',
	_hover: { color: 'fg' },
	'&[data-state="on"]': {
		bg: 'bg',
		color: 'fg',
		boxShadow: 'sm',
	},
	'& svg': { width: '1em', height: '1em', flexShrink: 0 },
});
</script>

<ToggleGroup.Root
	{value}
	{multiple}
	onValueChange={(details) => onValueChange(details.value)}
	class={className ?? root}
>
	{#each items as toggleItem (toggleItem.value)}
		<ToggleGroup.Item value={toggleItem.value} class={item}>
			{#if toggleItem.icon}
				{@render toggleItem.icon()}
			{/if}
			{toggleItem.label}
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>
