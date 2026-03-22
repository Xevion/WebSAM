import { FiniteStateMachine } from 'runed';
import { getLogger } from '@logtape/logtape';
import { appState, undoLastPrompt, redoLastPrompt } from './app-state.svelte';
import { getWorkerApi, withTimeout } from '$lib/inference/worker-api';
import { imageToRawData } from '$lib/utils/image';
import { errorMessage } from '$lib/utils/error';
import { toaster } from '$lib/stores/toast.svelte';
import { scheduleSave } from './persistence.svelte';
import * as Comlink from 'comlink';
import type { ModelInfo, Point, Box, DownloadProgress, EmbeddingInfo } from '$lib/inference/types';

const logger = getLogger(['websam', 'pipeline']);

export type PipelinePhase = 'no-model' | 'downloading' | 'model-ready' | 'encoding' | 'ready' | 'decoding' | 'error';

type PipelineEvent = 'select' | 'complete' | 'encode' | 'done' | 'decode' | 'fail' | 'cancel' | 'retry' | 'reset';

export const pipelineState = $state({
	downloadProgress: { stage: 'idle', bytesDownloaded: 0, totalBytes: 0 } as DownloadProgress,
	error: null as string | null,
	lastEncodeMs: null as number | null,
	lastDecodeMs: null as number | null,
	encodeSubstage: null as 'preprocessing' | 'inference' | null,
	emaEncodeMs: 3000,
	emaDecodeMs: 200,
	operationStartTime: null as number | null,
	operationElapsedMs: 0,
});

/** Reusable Comlink proxy for download progress — avoids leaking a new proxy per model switch. */
const downloadProgressProxy = Comlink.proxy((p: DownloadProgress) => {
	pipelineState.downloadProgress = p;
});

/** Embedding confirmation from the worker -- module-private, exposed via hasEmbedding. */
let embedding = $state<EmbeddingInfo | null>(null);

let decodeRequestId = 0;
let pendingDecode_: { points: Point[]; box: Box | null } | null = null;
let hasPendingDecode_ = $state(false);
let hoverRequestId = 0;

let hoverInferenceRunning = $state(false);
let hoverPendingCoords: { x: number; y: number } | null = null;
const EMA_ALPHA_DOWN = 0.5;
const EMA_ALPHA_UP = 0.1;
let emaHoverLatency = $state(150);

/** Adaptive debounce floor: ~30% of measured decode latency, clamped to [16, 300]ms */
const hoverDebounceFloor_ = $derived(Math.max(16, Math.min(300, Math.round(emaHoverLatency * 0.3))));

export function getHoverDebounceFloor(): number {
	return hoverDebounceFloor_;
}

/** Current EMA hover latency estimate in ms. */
export function getEmaHoverLatency(): number {
	return Math.round(emaHoverLatency);
}

/** Whether a hover decode is currently in-flight. */
export function getHoverInferenceRunning(): boolean {
	return hoverInferenceRunning;
}

/** Whether a decode is queued behind the in-flight one. */
export function getHasPendingDecode(): boolean {
	return hasPendingDecode_;
}

function setPendingDecode(value: { points: Point[]; box: Box | null } | null): void {
	pendingDecode_ = value;
	hasPendingDecode_ = value !== null;
}

/** Update an EMA value with asymmetric alpha (fast down, slow up). */
function updateEma(current: number, measured: number): number {
	const alpha = measured < current ? EMA_ALPHA_DOWN : EMA_ALPHA_UP;
	return alpha * measured + (1 - alpha) * current;
}

/** Reusable Comlink proxy for encode substage progress. */
const encodeSubstageProxy = Comlink.proxy((stage: 'preprocessing' | 'inference') => {
	pipelineState.encodeSubstage = stage;
});

let elapsedInterval: ReturnType<typeof setInterval> | null = null;

function startElapsedTicker(): void {
	pipelineState.operationStartTime = performance.now();
	pipelineState.operationElapsedMs = 0;
	if (elapsedInterval) clearInterval(elapsedInterval);
	elapsedInterval = setInterval(() => {
		if (pipelineState.operationStartTime !== null) {
			pipelineState.operationElapsedMs = Math.round(performance.now() - pipelineState.operationStartTime);
		}
	}, 100);
}

function stopElapsedTicker(): void {
	if (elapsedInterval) {
		clearInterval(elapsedInterval);
		elapsedInterval = null;
	}
	pipelineState.operationStartTime = null;
}

let rethresholdTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Send an event to the FSM with automatic transition logging.
 * All FSM interactions go through this to ensure visibility.
 */
function sendEvent(event: PipelineEvent): PipelinePhase {
	const from = pipeline.current;
	const result = pipeline.send(event);
	if (result !== from) {
		logger.info(`${from} -> ${result} (${event})`);
	} else {
		logger.debug(`Event '${event}' ignored in '${from}'`);
	}
	return result;
}

export const pipeline = new FiniteStateMachine<PipelinePhase, PipelineEvent>('no-model', {
	'no-model': {
		select: 'downloading',
	},
	downloading: {
		_enter() {
			void performDownload();
		},
		complete: 'model-ready',
		fail: 'error',
		cancel: 'no-model',
	},
	'model-ready': {
		_enter() {
			if (appState.currentImage && !embedding) {
				// Defer to avoid nested FSM transition during downloading._enter chain
				queueMicrotask(() => encodeCurrentImage());
			}
		},
		encode: 'encoding',
		select: () => {
			cancelCurrentOperation();
			return undefined;
		},
	},
	encoding: {
		_enter() {
			startElapsedTicker();
			pipelineState.encodeSubstage = null;
			void performEncode();
		},
		done: 'ready',
		fail: 'error',
	},
	ready: {
		_enter() {
			stopElapsedTicker();
			pipelineState.encodeSubstage = null;
		},
		decode: 'decoding',
		encode: 'encoding',
	},
	decoding: {
		_enter() {
			startElapsedTicker();
		},
		done: 'ready',
		fail: 'error',
		encode: 'encoding',
	},
	error: {
		_enter() {
			stopElapsedTicker();
			pipelineState.encodeSubstage = null;
		},
		retry: () => {
			if (appState.selectedModel) return 'downloading';
			return 'no-model';
		},
		select: () => undefined,
		reset: 'no-model',
	},
	'*': {
		reset: 'no-model',
	},
});

const isModelReady_ = $derived(
	pipeline.current === 'model-ready' ||
		pipeline.current === 'encoding' ||
		pipeline.current === 'ready' ||
		pipeline.current === 'decoding',
);

const canHoverDecode_ = $derived(pipeline.current === 'ready' && appState.currentImage !== null);

/** Whether the model is loaded and ready for inference. */
export function getIsModelReady(): boolean {
	return isModelReady_;
}

/** Whether hover decode is possible. */
export function getCanHoverDecode(): boolean {
	return canHoverDecode_;
}

/** Current pipeline phase (for diagnostics). */
export function getPipelinePhase(): PipelinePhase {
	return pipeline.current;
}

function cancelCurrentOperation(): void {
	void getWorkerApi().cancelDownload();
	hoverInferenceRunning = false;
	hoverPendingCoords = null;
	setPendingDecode(null);
	if (rethresholdTimer) {
		clearTimeout(rethresholdTimer);
		rethresholdTimer = null;
	}
}

async function performDownload(): Promise<void> {
	const model = appState.selectedModel;
	if (!model) {
		logger.error('performDownload called without selected model');
		return;
	}
	const snapshot = $state.snapshot(model);
	logger.info(`Starting model download/init: ${snapshot.id}`);

	const api = getWorkerApi();
	try {
		await withTimeout(api.downloadAndInit(snapshot, downloadProgressProxy), 300_000, 'downloadAndInit');
		pipelineState.downloadProgress = {
			stage: 'ready',
			bytesDownloaded: snapshot.totalSize,
			totalBytes: snapshot.totalSize,
		};
		if (pipeline.current === 'downloading') {
			sendEvent('complete');
		}
	} catch (err) {
		if (pipeline.current !== 'downloading') return;
		if (err instanceof DOMException && err.name === 'AbortError') {
			logger.info(`Model init aborted: ${snapshot.id}`);
			sendEvent('cancel');
		} else {
			logger.error(`Model init failed: ${snapshot.id} - ${errorMessage(err)}`);
			pipelineState.error = err instanceof Error ? err.message : 'Unknown error';
			pipelineState.downloadProgress = {
				stage: 'error',
				bytesDownloaded: 0,
				totalBytes: 0,
				error: pipelineState.error,
			};
			sendEvent('fail');
		}
	}
}

async function performEncode(): Promise<void> {
	if (!appState.currentImage) return;

	logger.info('Starting image encode');
	const api = getWorkerApi();
	const start = performance.now();
	try {
		const rawData = imageToRawData(appState.currentImage);
		embedding = await withTimeout(api.encode(rawData, encodeSubstageProxy), 120_000, 'encode');
		if (pipeline.current !== 'encoding') return;
		const elapsed = Math.round(performance.now() - start);
		pipelineState.lastEncodeMs = elapsed;
		pipelineState.emaEncodeMs = updateEma(pipelineState.emaEncodeMs, elapsed);
		logger.info(`Image encoded in ${elapsed}ms`);
		const postEncodePhase = sendEvent('done');

		// Auto-decode if prompts exist (e.g. session restore with saved points)
		if (postEncodePhase === 'ready' && (appState.points.length > 0 || appState.box)) {
			logger.info('Auto-decoding: prompts exist after encode');
			decodePrompts(appState.points, appState.box);
		}
	} catch (err) {
		if (pipeline.current !== 'encoding') return;
		logger.error(`Image encoding failed: ${errorMessage(err)}`);
		pipelineState.error = err instanceof Error ? err.message : 'Encoding failed';
		sendEvent('fail');
	}
}

async function performDecode(points: Point[], box: Box | null): Promise<void> {
	if (!embedding || !appState.currentImage) {
		logger.warn(`performDecode called without ${!embedding ? 'embedding' : 'image'}`);
		drainOrComplete();
		return;
	}
	const currentImage = appState.currentImage;

	const myId = ++decodeRequestId;
	logger.info(
		`Decode #${myId}: ${points.length} points, box=${!!box}, ${currentImage.naturalWidth}x${currentImage.naturalHeight}`,
	);
	const api = getWorkerApi();
	const start = performance.now();

	try {
		const previousMask = appState.maskResult?.lowResMasks ?? null;
		let maskInput: Float32Array | null = null;
		if (previousMask && appState.maskResult) {
			const idx = appState.maskResult.selectedIndex;
			maskInput = new Float32Array(256 * 256);
			maskInput.set(previousMask.subarray(idx * 256 * 256, (idx + 1) * 256 * 256));
		}

		const result = await withTimeout(
			api.decode(
				{
					points: points.length > 0 ? points : undefined,
					box: box ?? undefined,
				},
				{
					maskInput,
					outputWidth: currentImage.naturalWidth,
					outputHeight: currentImage.naturalHeight,
				},
			),
			10_000,
			'decode',
		);

		if (pipeline.current !== 'decoding') return;

		const elapsed = Math.round(performance.now() - start);
		if (!pendingDecode_) {
			pipelineState.lastDecodeMs = elapsed;
			pipelineState.emaDecodeMs = updateEma(pipelineState.emaDecodeMs, elapsed);
			appState.maskResult = result;
		}
		logger.info(`Decode #${myId} complete in ${elapsed}ms${pendingDecode_ ? ' (superseded)' : ''}`);
		drainOrComplete();
	} catch (err) {
		if (pipeline.current !== 'decoding') return;
		const msg = errorMessage(err);
		const isTimeout = msg.includes('timed out');
		if (pendingDecode_ && !isTimeout) {
			logger.warn(`Decode #${myId} failed (${msg}), trying queued decode`);
			drainOrComplete();
		} else {
			if (pendingDecode_) {
				setPendingDecode(null);
				logger.warn(`Decode #${myId} timed out, discarding queued decode`);
			}
			logger.error(`Decode failed: ${msg}`);
			pipelineState.error = err instanceof Error ? err.message : 'Decoding failed';
			toaster.error({
				title: isTimeout ? 'Worker unresponsive' : 'Decode failed',
				description: isTimeout ? 'The inference worker stopped responding. Try clicking again or reload.' : msg,
			});
			sendEvent('fail');
		}
	}
}

/**
 * Drain the pending decode queue, or transition to ready if empty.
 */
function drainOrComplete(): void {
	if (pendingDecode_ && pipeline.current === 'decoding') {
		const next = pendingDecode_;
		setPendingDecode(null);
		void performDecode(next.points, next.box);
	} else if (pipeline.current === 'decoding') {
		sendEvent('done');
	}
}

/**
 * Select and initialize a model. Safe to call from any state --
 * cancels in-flight work and restarts the pipeline.
 */
export function selectModel(model: ModelInfo): void {
	resetPipeline();
	appState.selectedModel = model;
	pipelineState.downloadProgress = { stage: 'idle', bytesDownloaded: 0, totalBytes: model.totalSize };
	sendEvent('select');
}

/** Cancel an in-flight model download. */
export function cancelDownload(): void {
	logger.info('Download cancellation requested');
	void getWorkerApi().cancelDownload();
}

/** Retry from error state -- re-downloads the selected model. */
export function retryFromError(): void {
	if (pipeline.current !== 'error') return;
	pipelineState.error = null;
	sendEvent('retry');
}

/**
 * Encode the current image. Called after image load when model is ready.
 * Also called by the auto-trigger in model-ready._enter.
 *
 * Accepts model-ready, ready, and decoding phases -- the FSM supports
 * encode transitions from all three.
 */
export function encodeCurrentImage(): void {
	if (!appState.currentImage) return;
	const phase = pipeline.current;
	if (phase !== 'model-ready' && phase !== 'ready' && phase !== 'decoding') {
		logger.warn(`encodeCurrentImage rejected: pipeline is '${phase}'`);
		return;
	}
	embedding = null;
	setPendingDecode(null);
	sendEvent('encode');
}

/**
 * Run the decoder with the given prompts. Handles both initial decode
 * (from ready state) and re-decode (while already decoding).
 */
export function decodePrompts(points: Point[], box: Box | null): void {
	if (points.length === 0 && !box) {
		logger.warn('decodePrompts skipped: no points or box provided');
		appState.maskResult = null;
		scheduleSave();
		return;
	}
	const snappedPoints = $state.snapshot(points);
	const snappedBox = box ? $state.snapshot(box) : null;
	if (pipeline.current === 'ready') {
		sendEvent('decode');
		void performDecode(snappedPoints, snappedBox);
	} else if (pipeline.current === 'decoding') {
		setPendingDecode({ points: snappedPoints, box: snappedBox });
		logger.info(`Decode queued: ${snappedPoints.length} points (superseding in-flight)`);
	} else if (pipeline.current === 'model-ready' || pipeline.current === 'encoding') {
		logger.warn(`decodePrompts rejected: image not yet encoded (pipeline is '${pipeline.current}')`);
	} else {
		logger.error(`decodePrompts rejected: pipeline is '${pipeline.current}'`);
	}
}

/** Undo last prompt and re-run decoder. */
export function undoAndDecode(): void {
	undoLastPrompt();
	decodePrompts(appState.points, appState.box);
}

/** Redo last prompt and re-run decoder. */
export function redoAndDecode(): void {
	redoLastPrompt();
	decodePrompts(appState.points, appState.box);
}

/** Notify the pipeline that the image was removed (clears embedding + hover state). */
export function onImageRemoved(): void {
	embedding = null;
	cancelHoverDecode();
}

/** Clear the embedding (e.g. when image changes). */
export function clearEmbedding(): void {
	embedding = null;
}

/** Reset pipeline to no-model state, clearing all inference artifacts. */
export function resetPipeline(): void {
	cancelCurrentOperation();
	embedding = null;
	pipelineState.error = null;
	pipelineState.lastEncodeMs = null;
	pipelineState.lastDecodeMs = null;
	appState.maskResult = null;
	if (pipeline.current !== 'no-model') {
		sendEvent('reset');
	}
}

/**
 * Handle a worker crash -- resets the pipeline to error state.
 * Called from the worker error listener in +page.svelte.
 */
export function handleWorkerError(err: Error): void {
	cancelCurrentOperation();
	embedding = null;
	pipelineState.error = `Worker crashed: ${err.message}`;
	pipelineState.downloadProgress = {
		stage: 'error',
		bytesDownloaded: 0,
		totalBytes: 0,
		error: 'Worker crashed. Select model to restart.',
	};
	if (pipeline.current !== 'error' && pipeline.current !== 'no-model') {
		sendEvent('fail');
	}
}

/**
 * Schedule a hover decode at the given image-space coordinates.
 * Uses single-inflight + drain-latest concurrency control.
 */
export function scheduleHoverDecode(imageX: number, imageY: number): void {
	if (!canHoverDecode_ || !appState.currentImage) return;

	if (
		imageX < 0 ||
		imageY < 0 ||
		imageX >= appState.currentImage.naturalWidth ||
		imageY >= appState.currentImage.naturalHeight
	) {
		appState.hoverMask = null;
		appState.hoverTriggerPos = null;
		return;
	}

	if (hoverInferenceRunning) {
		hoverPendingCoords = { x: imageX, y: imageY };
		logger.debug('Hover decode queued (in-flight)');
		return;
	}
	void runHoverDecode(imageX, imageY);
}

async function runHoverDecode(imageX: number, imageY: number): Promise<void> {
	if (!appState.currentImage || !embedding) return;

	hoverInferenceRunning = true;
	const myId = ++hoverRequestId;
	const api = getWorkerApi();
	const t0 = performance.now();
	logger.debug(`Hover decode #${myId} started at (${Math.round(imageX)}, ${Math.round(imageY)})`);
	try {
		const hoverPoints: Point[] = [...$state.snapshot(appState.points), { x: imageX, y: imageY, label: 1 as const }];

		const previousMask = appState.maskResult?.lowResMasks ?? null;
		let maskInput: Float32Array | null = null;
		if (previousMask && appState.maskResult) {
			const idx = appState.maskResult.selectedIndex;
			maskInput = new Float32Array(256 * 256);
			maskInput.set(previousMask.subarray(idx * 256 * 256, (idx + 1) * 256 * 256));
		}

		const result = await withTimeout(
			api.decode(
				{ points: hoverPoints },
				{
					maskInput,
					outputWidth: appState.currentImage.naturalWidth,
					outputHeight: appState.currentImage.naturalHeight,
				},
			),
			5_000,
			'hover-decode',
		);
		const elapsed = Math.round(performance.now() - t0);
		const alpha = elapsed < emaHoverLatency ? EMA_ALPHA_DOWN : EMA_ALPHA_UP;
		emaHoverLatency = alpha * elapsed + (1 - alpha) * emaHoverLatency;
		if (myId !== hoverRequestId) {
			logger.debug(`Hover decode #${myId} stale, discarded`);
			return;
		}
		logger.debug(`Hover decode #${myId} complete in ${elapsed}ms`);
		appState.hoverMask = result.masks[result.selectedIndex] ?? null;
		appState.hoverTriggerPos = appState.hoverMask ? { x: imageX, y: imageY } : null;
	} catch {
		logger.debug(`Hover decode #${myId} failed`);
		appState.hoverMask = null;
		appState.hoverTriggerPos = null;
		hoverPendingCoords = null;
	} finally {
		hoverInferenceRunning = false;
		if (hoverPendingCoords) {
			logger.debug('Draining pending hover decode');
			const { x, y } = hoverPendingCoords;
			hoverPendingCoords = null;
			void runHoverDecode(x, y);
		}
	}
}

const SEGMENT_PALETTE = [
	'#ef4444',
	'#f97316',
	'#eab308',
	'#22c55e',
	'#06b6d4',
	'#3b82f6',
	'#8b5cf6',
	'#ec4899',
	'#f43f5e',
	'#14b8a6',
	'#a855f7',
	'#6366f1',
	'#0ea5e9',
	'#84cc16',
	'#d946ef',
	'#f59e0b',
];

/**
 * Run "Everything" mode: generate a 16x16 grid of foreground points,
 * decode each one individually, and collect high-confidence masks.
 */
export async function runEverythingMode(): Promise<void> {
	if (pipeline.current !== 'ready' || !appState.currentImage) {
		logger.warn(`runEverythingMode rejected: pipeline='${pipeline.current}', image=${!!appState.currentImage}`);
		return;
	}

	const img = appState.currentImage;
	const outputWidth = img.naturalWidth;
	const outputHeight = img.naturalHeight;
	const gridSize = 16;
	const totalPoints = gridSize * gridSize;

	const points: { x: number; y: number }[] = [];
	const stepX = outputWidth / (gridSize + 1);
	const stepY = outputHeight / (gridSize + 1);
	for (let gy = 1; gy <= gridSize; gy++) {
		for (let gx = 1; gx <= gridSize; gx++) {
			points.push({ x: gx * stepX, y: gy * stepY });
		}
	}

	appState.everythingMasks = [];
	appState.everythingProgress = { current: 0, total: totalPoints };
	logger.info(`Everything mode: ${totalPoints} grid points, ${outputWidth}x${outputHeight}`);

	const api = getWorkerApi();
	const results: { mask: ImageData; color: string; score: number }[] = [];

	for (let i = 0; i < points.length; i++) {
		const pt = points[i];
		appState.everythingProgress = { current: i + 1, total: totalPoints };

		try {
			const result = await withTimeout(
				api.decode(
					{ points: [{ x: pt.x, y: pt.y, label: 1 as const }] },
					{ maskInput: null, outputWidth, outputHeight },
				),
				5_000,
				`everything-decode-${i}`,
			);

			const bestScore = result.scores[result.selectedIndex];
			if (bestScore > 0.7) {
				const bestMask = result.masks[result.selectedIndex];
				const color = SEGMENT_PALETTE[results.length % SEGMENT_PALETTE.length];
				results.push({ mask: bestMask, color, score: bestScore });
			}
		} catch (err) {
			logger.warn(`Everything decode point ${i} failed: ${errorMessage(err)}`);
		}
	}

	appState.everythingMasks = results;
	appState.everythingProgress = null;
	logger.info(`Everything mode complete: ${results.length}/${totalPoints} masks kept (IoU > 0.7)`);
}

/** Cancel any pending hover decode. */
export function cancelHoverDecode(): void {
	hoverPendingCoords = null;
	appState.hoverMask = null;
	appState.hoverTriggerPos = null;
}

/**
 * Debounced rethreshold of existing decode results.
 * Call whenever maskThreshold or maskSmoothPasses changes.
 */
export function scheduleRethreshold(threshold: number, smoothPasses: number): void {
	if (rethresholdTimer) clearTimeout(rethresholdTimer);
	rethresholdTimer = setTimeout(() => {
		if (!appState.maskResult || !appState.currentImage) return;
		if (pipeline.current !== 'ready') return;
		const api = getWorkerApi();
		void withTimeout(
			api.rethreshold(
				threshold,
				smoothPasses,
				appState.currentImage.naturalWidth,
				appState.currentImage.naturalHeight,
			),
			5_000,
			'rethreshold',
		)
			.then((result) => {
				if (result) appState.maskResult = result;
			})
			.catch((err) => {
				logger.error(`Rethreshold failed: ${errorMessage(err)}`);
			});
	}, 150);
}

/**
 * Initialize pipeline auto-trigger effects. Call from +page.svelte's onMount
 * or top-level script block. Returns a cleanup function.
 */
export function initPipelineEffects(): () => void {
	return $effect.root(() => {
		$effect(() => {
			const threshold = appState.maskThreshold;
			const smoothPasses = appState.maskSmoothPasses;
			scheduleRethreshold(threshold, smoothPasses);
		});
	});
}
