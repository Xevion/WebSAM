<script lang="ts">
import { pipelineState, cancelDownload, retryFromError } from '$lib/stores/inference-pipeline.svelte';
import { formatBytes } from '$lib/inference/models';
import Progress from '$lib/components/ui/progress.svelte';
import Button from '$lib/components/ui/button.svelte';
import X from '@lucide/svelte/icons/x';
import CheckCircle from '@lucide/svelte/icons/check-circle';
import AlertCircle from '@lucide/svelte/icons/alert-circle';
import Loader from '@lucide/svelte/icons/loader-circle';
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import { css } from 'styled-system/css';

const progress = $derived(pipelineState.downloadProgress);

const progressPercent = $derived(
	progress.totalBytes > 0 ? Math.round((progress.bytesDownloaded / progress.totalBytes) * 100) : 0,
);

const stageLabel = $derived.by(() => {
	switch (progress.stage) {
		case 'idle':
			return 'Preparing download\u2026';
		case 'downloading-encoder':
			return 'Downloading encoder...';
		case 'downloading-decoder':
			return 'Downloading decoder...';
		case 'initializing':
			return 'Initializing session...';
		case 'ready':
			return 'Model ready';
		case 'error':
			return progress.error ?? 'Failed';
	}
});

const wrapper = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '3',
});

const statusRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	fontSize: 'sm',
});

const statusIcon = css({
	flexShrink: 0,
});

const spinning = css({
	animation: 'spin 1s linear infinite',
});

const sizeInfo = css({
	fontSize: 'xs',
	color: 'fg.muted',
	textAlign: 'right',
});

const actions = css({
	display: 'flex',
	gap: '2',
});
</script>

<div class={wrapper}>
	<div class={statusRow}>
		{#if progress.stage === 'ready'}
			<CheckCircle size={16} class={css({ color: 'success.fg', flexShrink: 0 })} />
		{:else if progress.stage === 'error'}
			<AlertCircle size={16} class={css({ color: 'danger.subtleFg', flexShrink: 0 })} />
		{:else if progress.stage !== 'idle'}
			<Loader size={16} class={`${statusIcon} ${spinning}`} />
		{/if}
		<span>{stageLabel}</span>
	</div>

	{#if progress.stage !== 'idle' && progress.stage !== 'ready' && progress.stage !== 'error'}
		<Progress value={progressPercent} label="Download progress" />
		<div class={sizeInfo}>
			{formatBytes(progress.bytesDownloaded)} / {formatBytes(progress.totalBytes)}
		</div>
	{/if}

	<div class={actions}>
		{#if progress.stage !== 'idle' && progress.stage !== 'ready' && progress.stage !== 'error'}
			<Button size="sm" variant="outline" onclick={cancelDownload}>
				<X size={14} />
				Cancel
			</Button>
		{:else if progress.stage === 'error'}
			<Button size="sm" onclick={retryFromError}>
				<RefreshCw size={14} />
				Retry
			</Button>
		{/if}
	</div>
</div>
