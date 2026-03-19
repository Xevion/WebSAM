<script lang="ts">
import { Tabs } from '@ark-ui/svelte/tabs';
import { css } from 'styled-system/css';
import type { Snippet } from 'svelte';

interface TabItem {
	value: string;
	label: string;
	icon?: Snippet;
}

interface Props {
	items: TabItem[];
	value: string;
	onValueChange: (value: string) => void;
	class?: string;
}

const { items, value, onValueChange, class: className }: Props = $props();

const list = css({
	display: 'flex',
	gap: '1',
	borderBottomWidth: '1px',
	borderColor: 'border',
	pb: '0',
});

const trigger = css({
	display: 'inline-flex',
	alignItems: 'center',
	gap: '1.5',
	px: '3',
	py: '2',
	fontSize: 'sm',
	fontWeight: 'medium',
	color: 'fg.muted',
	cursor: 'pointer',
	border: 'none',
	bg: 'transparent',
	borderBottomWidth: '2px',
	borderColor: 'transparent',
	transition: 'all 150ms',
	_hover: { color: 'fg' },
	_selected: {
		color: 'primary',
		borderColor: 'primary',
	},
	'& svg': { width: '1em', height: '1em', flexShrink: 0 },
});
</script>

<Tabs.Root {value} onValueChange={(details) => onValueChange(details.value)} class={className}>
	<Tabs.List class={list}>
		{#each items as tab (tab.value)}
			<Tabs.Trigger value={tab.value} class={trigger}>
				{#if tab.icon}
					{@render tab.icon()}
				{/if}
				{tab.label}
			</Tabs.Trigger>
		{/each}
		<Tabs.Indicator />
	</Tabs.List>
</Tabs.Root>
