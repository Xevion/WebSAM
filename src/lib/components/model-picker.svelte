<script lang="ts">
import { appState } from '$lib/stores/app-state.svelte';
import { MODEL_REGISTRY, MODEL_FAMILIES, formatBytes } from '$lib/inference/models';
import { isModelCached } from '$lib/inference/download';
import { Select, createListCollection } from '@ark-ui/svelte/select';

let modelCached = $state(false);

$effect(() => {
	const modelId = appState.selectedModel?.id;
	if (modelId) {
		isModelCached(modelId).then((cached) => {
			modelCached = cached;
		});
	} else {
		modelCached = false;
	}
});
import { Portal } from '@ark-ui/svelte/portal';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import Check from '@lucide/svelte/icons/check';
import HardDrive from '@lucide/svelte/icons/hard-drive';
import Cpu from '@lucide/svelte/icons/cpu';
import { css } from 'styled-system/css';

const items = $derived(
	MODEL_REGISTRY.filter((m) => !m.requiresWebGPU || appState.webgpuAvailable).map((m) => ({
		label: m.name,
		value: m.id,
		model: m,
	})),
);

const collection = $derived(createListCollection({ items }));

const selectedValue = $derived(appState.selectedModel ? [appState.selectedModel.id] : []);

function handleValueChange(value: string[]) {
	const id = value[0];
	const model = MODEL_REGISTRY.find((m) => m.id === id);
	appState.selectedModel = model ?? null;
	if (model) {
		appState.downloadProgress = { stage: 'idle', bytesDownloaded: 0, totalBytes: model.totalSize };
		appState.isModelReady = false;
	}
}

const wrapper = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '2',
});

const label = css({
	fontSize: 'sm',
	fontWeight: 'semibold',
	color: 'fg',
});

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
	transition: 'border-color 150ms',
	_focusVisible: {
		outline: 'none',
		borderColor: 'primary',
		outlineWidth: '1px',
		outlineColor: 'primary',
		outlineStyle: 'solid',
	},
	_open: { borderColor: 'primary', outlineWidth: '1px', outlineColor: 'primary', outlineStyle: 'solid' },
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

const content = css({
	bg: 'bg',
	borderWidth: '1px',
	borderColor: 'border',
	borderRadius: 'lg',
	boxShadow: 'lg',
	outline: 'none',
	p: '1',
	minW: '14rem',
	maxH: '20rem',
	overflowY: 'auto',
	zIndex: '50',
	_open: { animation: 'fade-in 120ms ease-out' },
	_closed: { animation: 'fade-out 100ms ease-in' },
});

const groupLabel = css({
	px: '2',
	py: '1',
	fontSize: 'xs',
	fontWeight: 'semibold',
	color: 'fg.muted',
	textTransform: 'uppercase',
	letterSpacing: 'wider',
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

const itemMeta = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1',
	ml: 'auto',
	fontSize: 'xs',
	color: 'fg.muted',
});

const chevronIcon = css({
	color: 'fg.muted',
	flexShrink: 0,
	transition: 'transform 200ms',
});

const indicatorStyle = css({
	color: 'primary',
});

const modelDetail = css({
	mt: '2',
	p: '3',
	bg: 'bg.subtle',
	borderRadius: 'md',
	fontSize: 'xs',
	color: 'fg.muted',
	display: 'flex',
	flexDirection: 'column',
	gap: '1',
});

const detailRow = css({
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
});

const cachedBadge = css({
	fontSize: 'xs',
	color: 'success.fg',
	bg: 'success.subtle',
	px: '1.5',
	py: '0.5',
	borderRadius: 'full',
	fontWeight: 'medium',
});
</script>

<div class={wrapper}>
	<span class={label}>Model</span>

	<Select.Root
		collection={collection}
		value={selectedValue}
		onValueChange={(details) => handleValueChange(details.value)}
	>
		<Select.Control>
			<Select.Trigger class={trigger}>
				<Cpu size={14} />
				<Select.ValueText class={valueText} placeholder="Choose a model..." />
				<ChevronDown size={14} class={chevronIcon} />
			</Select.Trigger>
		</Select.Control>
		<Portal>
			<Select.Positioner>
				<Select.Content class={content}>
					{#each MODEL_FAMILIES as family (family.id)}
						<Select.ItemGroup>
							<Select.ItemGroupLabel class={groupLabel}>{family.label}</Select.ItemGroupLabel>
							{#each items.filter((i) => i.model.family === family.id) as selectItem (selectItem.value)}
								<Select.Item item={selectItem} class={item}>
									<Select.ItemText>{selectItem.label}</Select.ItemText>
									<span class={itemMeta}>
										{formatBytes(selectItem.model.totalSize)}
										{#if selectItem.model.requiresWebGPU}
											<HardDrive size={12} />
										{/if}
									</span>
									<Select.ItemIndicator class={indicatorStyle}>
										<Check size={14} />
									</Select.ItemIndicator>
								</Select.Item>
							{/each}
						</Select.ItemGroup>
					{/each}
				</Select.Content>
			</Select.Positioner>
		</Portal>
	</Select.Root>

	{#if appState.selectedModel}
		<div class={modelDetail}>
			<div class={detailRow}>
				<span>{appState.selectedModel.description}</span>
			</div>
			<div class={detailRow}>
				<span>Encoder: {formatBytes(appState.selectedModel.encoderSize)}</span>
				<span>Decoder: {formatBytes(appState.selectedModel.decoderSize)}</span>
			</div>
			<div class={detailRow}>
				<span>Quantization: {appState.selectedModel.quantization.toUpperCase()}</span>
				{#if modelCached}
					<span class={cachedBadge}>Cached</span>
				{/if}
			</div>
			{#if !appState.webgpuAvailable && appState.selectedModel.family !== 'sam1'}
				<div class={css({ color: 'danger.subtleFg', fontWeight: 'medium' })}>
					WebGPU required but not available
				</div>
			{/if}
		</div>
	{/if}
</div>
