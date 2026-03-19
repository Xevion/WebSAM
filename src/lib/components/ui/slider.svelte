<script lang="ts">
import { Slider } from '@ark-ui/svelte/slider';
import { css } from 'styled-system/css';

interface Props {
	value: number[];
	onValueChange: (value: number[]) => void;
	min?: number;
	max?: number;
	step?: number;
	label?: string;
	class?: string;
}

const { value, onValueChange, min = 0, max = 100, step = 1, label, class: className }: Props = $props();

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

const control = css({
	position: 'relative',
	display: 'flex',
	alignItems: 'center',
	h: '5',
	cursor: 'pointer',
});

const track = css({
	bg: 'bg.emphasis',
	borderRadius: 'full',
	h: '1.5',
	w: 'full',
	overflow: 'hidden',
});

const range = css({
	bg: 'primary',
	h: 'full',
	borderRadius: 'full',
});

const thumb = css({
	w: '4',
	h: '4',
	borderRadius: 'full',
	bg: 'primary',
	borderWidth: '2px',
	borderColor: 'bg',
	boxShadow: 'sm',
	cursor: 'grab',
	outline: 'none',
	_focusVisible: {
		outlineWidth: '2px',
		outlineColor: 'primary',
		outlineOffset: '2px',
		outlineStyle: 'solid',
	},
	_active: { cursor: 'grabbing' },
});
</script>

<Slider.Root
	{value}
	{min}
	{max}
	{step}
	onValueChange={(details) => onValueChange(details.value)}
	class={className ?? root}
>
	{#if label}
		<div class={labelStyle}>
			<Slider.Label>{label}</Slider.Label>
			<Slider.ValueText />
		</div>
	{/if}
	<Slider.Control class={control}>
		<Slider.Track class={track}>
			<Slider.Range class={range} />
		</Slider.Track>
		<Slider.Thumb index={0} class={thumb} />
	</Slider.Control>
</Slider.Root>
