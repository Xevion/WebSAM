<script lang="ts">
import { appState } from '$lib/stores/app-state.svelte';
import SliderComponent from '$lib/components/ui/slider.svelte';
import ToggleGroupComponent from '$lib/components/ui/toggle-group.svelte';
import { css } from 'styled-system/css';

const viewModeItems = [
	{ value: 'overlay', label: 'Overlay' },
	{ value: 'outline', label: 'Outline' },
	{ value: 'cutout', label: 'Cutout' },
];

const colorPresets = [
	{ value: '#6366f1', label: 'Indigo' },
	{ value: '#3b82f6', label: 'Blue' },
	{ value: '#10b981', label: 'Green' },
	{ value: '#f59e0b', label: 'Amber' },
	{ value: '#ef4444', label: 'Red' },
	{ value: '#8b5cf6', label: 'Purple' },
];

function handleViewModeChange(value: string[]) {
	const mode = value[0] as 'overlay' | 'outline' | 'cutout';
	if (mode) appState.maskViewMode = mode;
}

function handleOpacityChange(value: number[]) {
	appState.maskOpacity = (value[0] ?? 50) / 100;
}

const wrapper = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '4',
});

const section = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '2',
});

const sectionLabel = css({
	fontSize: 'xs',
	fontWeight: 'semibold',
	color: 'fg.muted',
	textTransform: 'uppercase',
	letterSpacing: 'wider',
});

const colorGrid = css({
	display: 'flex',
	gap: '2',
	flexWrap: 'wrap',
});

const colorSwatch = css({
	w: '6',
	h: '6',
	borderRadius: 'full',
	cursor: 'pointer',
	border: 'none',
	transition: 'transform 150ms',
	_hover: { transform: 'scale(1.15)' },
});

const selectedSwatch = css({
	outlineWidth: '2px',
	outlineColor: 'primary',
	outlineOffset: '2px',
	outlineStyle: 'solid',
});

const maskList = css({
	display: 'flex',
	gap: '2',
	flexWrap: 'wrap',
});

const maskThumb = css({
	w: '16',
	h: '16',
	borderRadius: 'md',
	bg: 'bg.muted',
	borderWidth: '2px',
	borderColor: 'border',
	cursor: 'pointer',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	fontSize: 'xs',
	color: 'fg.muted',
	transition: 'border-color 150ms',
	_hover: { borderColor: 'primary' },
});

const maskThumbSelected = css({
	borderColor: 'primary',
	outlineWidth: '1px',
	outlineColor: 'primary',
	outlineStyle: 'solid',
});

const scoreLabel = css({
	fontSize: 'xs',
	color: 'fg.muted',
	textAlign: 'center',
	mt: '0.5',
});
</script>

<div class={wrapper}>
	<div class={section}>
		<span class={sectionLabel}>View Mode</span>
		<ToggleGroupComponent
			items={viewModeItems}
			value={[appState.maskViewMode]}
			onValueChange={handleViewModeChange}
		/>
	</div>

	<div class={section}>
		<span class={sectionLabel}>Mask Opacity</span>
		<SliderComponent
			value={[Math.round(appState.maskOpacity * 100)]}
			onValueChange={handleOpacityChange}
			min={0}
			max={100}
			step={5}
			label="Opacity"
		/>
	</div>

	<div class={section}>
		<span class={sectionLabel}>Mask Color</span>
		<div class={colorGrid}>
			{#each colorPresets as preset (preset.value)}
				<button
					class={`${colorSwatch} ${appState.maskColor === preset.value ? selectedSwatch : ''}`}
					style:background-color={preset.value}
					onclick={() => { appState.maskColor = preset.value; }}
					aria-label={preset.label}
				></button>
			{/each}
		</div>
	</div>

	{#if appState.maskResult && appState.maskResult.masks.length > 1}
		<div class={section}>
			<span class={sectionLabel}>Mask Selection</span>
			<div class={maskList}>
				{#each appState.maskResult.masks as _, i (i)}
					<div>
						<button
							class={`${maskThumb} ${appState.maskResult.selectedIndex === i ? maskThumbSelected : ''}`}
							onclick={() => { if (appState.maskResult) appState.maskResult.selectedIndex = i; }}
						>
							Mask {i + 1}
						</button>
						<div class={scoreLabel}>
							{((appState.maskResult.scores[i] ?? 0) * 100).toFixed(1)}%
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
