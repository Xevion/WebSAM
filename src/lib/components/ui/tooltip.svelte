<script lang="ts">
import { Tooltip } from '@ark-ui/svelte/tooltip';
import { Portal } from '@ark-ui/svelte/portal';
import { css } from 'styled-system/css';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

interface Props {
	content: string;
	children: Snippet<[(props?: Record<string, unknown>) => HTMLAttributes<HTMLElement>]>;
}

const { content: tooltipContent, children }: Props = $props();

const tooltipContentStyle = css({
	bg: 'neutral.800',
	color: 'neutral.0',
	px: '2',
	py: '1',
	borderRadius: 'md',
	fontSize: 'xs',
	fontWeight: 'medium',
	boxShadow: 'md',
	zIndex: '50',
	_dark: {
		bg: 'neutral.200',
		color: 'neutral.900',
	},
	_open: { animation: 'fade-in 100ms ease-out' },
	_closed: { animation: 'fade-out 75ms ease-in' },
});
</script>

<Tooltip.Root openDelay={300} closeDelay={0}>
	<Tooltip.Trigger>
		{#snippet asChild(props)}
			{@render children(props as (p?: Record<string, unknown>) => HTMLAttributes<HTMLElement>)}
		{/snippet}
	</Tooltip.Trigger>
	<Portal>
		<Tooltip.Positioner>
			<Tooltip.Content class={tooltipContentStyle}>
				{tooltipContent}
			</Tooltip.Content>
		</Tooltip.Positioner>
	</Portal>
</Tooltip.Root>
