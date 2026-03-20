<script lang="ts">
import { Progress } from '@ark-ui/svelte/progress';
import { css } from 'styled-system/css';

interface Props {
	/** Pass null for indeterminate progress. */
	value: number | null;
	max?: number;
	label?: string;
	class?: string;
	trackClass?: string;
	rangeClass?: string;
}

const { value, max = 100, label, class: className, trackClass, rangeClass }: Props = $props();

const root = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '1',
	w: 'full',
});

const labelStyle = css({
	display: 'flex',
	justifyContent: 'space-between',
	fontSize: 'xs',
	color: 'fg.muted',
});

const track = css({
	bg: 'bg.emphasis',
	borderRadius: 'full',
	h: '2',
	overflow: 'hidden',
});

const range = css({
	bg: 'primary',
	h: 'full',
	borderRadius: 'full',
	transition: 'width 200ms ease-out',
});
</script>

<Progress.Root {value} {max} class={className ?? root}>
	{#if label}
		<div class={labelStyle}>
			<Progress.Label>{label}</Progress.Label>
			<Progress.ValueText />
		</div>
	{/if}
	<Progress.Track class={trackClass ?? track}>
		<Progress.Range class={rangeClass ?? range} />
	</Progress.Track>
</Progress.Root>
