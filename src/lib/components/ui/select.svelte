<script lang="ts">
import { Select, createListCollection } from '@ark-ui/svelte/select';
import { Portal } from '@ark-ui/svelte/portal';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import Check from '@lucide/svelte/icons/check';
import { css, cx } from 'styled-system/css';
import type { Snippet } from 'svelte';

interface Item {
	label: string;
	value: string;
	disabled?: boolean;
}

interface Props {
	items: Item[];
	value: string[];
	onValueChange: (value: string[]) => void;
	placeholder?: string;
	name?: string;
	id?: string;
	triggerClass?: string;
	icon?: Snippet;
}

const {
	items,
	value,
	onValueChange,
	placeholder = 'Select...',
	name,
	id,
	triggerClass,
	icon,
}: Props = $props();

const collection = $derived(createListCollection({ items }));

const trigger = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	bg: 'bg',
	borderWidth: '1px',
	borderColor: 'border',
	borderRadius: 'md',
	px: '3',
	h: '10',
	w: 'full',
	cursor: 'pointer',
	fontSize: 'sm',
	fontWeight: 'medium',
	transition: 'border-color',
	transitionDuration: '150ms',
	_focusVisible: {
		outline: 'none',
		borderColor: 'primary',
		outlineWidth: '1px',
		outlineColor: 'primary',
		outlineStyle: 'solid',
	},
	_open: {
		borderColor: 'primary',
		outlineWidth: '1px',
		outlineColor: 'primary',
		outlineStyle: 'solid',
	},
	'& svg': { pointerEvents: 'none', flexShrink: 0, width: '1em', height: '1em' },
});

const valueText = css({
	flex: '1',
	fontSize: 'sm',
	textAlign: 'left',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
	'&[data-placeholder-shown]': { color: 'fg.subtle' },
});

const chevronIcon = css({
	color: 'fg.muted',
	flexShrink: 0,
	transition: 'transform 200ms',
});

const content = css({
	bg: 'bg',
	borderWidth: '1px',
	borderColor: 'border',
	borderRadius: 'lg',
	boxShadow: 'lg',
	outline: 'none',
	p: '1',
	minW: '10rem',
	zIndex: '50',
	_open: { animation: 'fade-in 120ms ease-out' },
	_closed: { animation: 'fade-out 100ms ease-in' },
});

const item = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	px: '2',
	py: '1.5',
	borderRadius: 'md',
	fontSize: 'sm',
	cursor: 'pointer',
	outline: 'none',
	userSelect: 'none',
	color: 'fg',
	transition: 'background 100ms',
	_hover: { bg: 'bg.muted' },
	_highlighted: { bg: 'bg.muted' },
});

const itemIndicator = css({
	ml: 'auto',
	color: 'primary',
});
</script>

<Select.Root
	{collection}
	{value}
	ids={id ? { trigger: id } : undefined}
	onValueChange={(details) => onValueChange(details.value)}
>
	<Select.Control>
		<Select.Trigger class={cx(triggerClass ?? trigger, '')}>
			{#if icon}
				{@render icon()}
			{/if}
			<Select.ValueText class={valueText} {placeholder} />
			<ChevronDown size={14} class={chevronIcon} />
		</Select.Trigger>
	</Select.Control>
	<Portal>
		<Select.Positioner>
			<Select.Content class={content}>
				{#each collection.items as selectItem (selectItem.value)}
					<Select.Item item={selectItem} class={item}>
						<Select.ItemText>{selectItem.label}</Select.ItemText>
						<Select.ItemIndicator class={itemIndicator}>
							<Check size={14} />
						</Select.ItemIndicator>
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Positioner>
	</Portal>
	{#if name}
		<Select.HiddenSelect {name} />
	{/if}
</Select.Root>
