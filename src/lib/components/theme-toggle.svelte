<script lang="ts">
import { themeStore } from '$lib/stores/theme.svelte';
import Sun from '@lucide/svelte/icons/sun';
import Moon from '@lucide/svelte/icons/moon';
import { Toggle } from '@ark-ui/svelte';
import { css } from 'styled-system/css';
import { toggle } from 'styled-system/recipes';
import { tick } from 'svelte';

const classes = toggle({ variant: 'outline', size: 'md' });

const sunIcon = css({
	position: 'absolute',
	w: '4',
	h: '4',
	transition: 'all',
	transitionDuration: '200ms',
	rotate: '0deg',
	scale: '1',
	_dark: { rotate: '-90deg', scale: '0' },
});

const moonIcon = css({
	position: 'absolute',
	w: '4',
	h: '4',
	transition: 'all',
	transitionDuration: '200ms',
	rotate: '90deg',
	scale: '0',
	_dark: { rotate: '0deg', scale: '1' },
});

const srOnly = css({
	position: 'absolute',
	width: '1px',
	height: '1px',
	padding: '0',
	margin: '-1px',
	overflow: 'hidden',
	clip: 'rect(0,0,0,0)',
	whiteSpace: 'nowrap',
	borderWidth: '0',
});

function handleToggle(event: MouseEvent) {
	const supportsViewTransition =
		typeof document !== 'undefined' &&
		'startViewTransition' in document &&
		!window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (!supportsViewTransition) {
		themeStore.toggle();
		return;
	}

	const x = event.clientX;
	const y = event.clientY;
	const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

	document.documentElement.classList.add('theme-transitioning');

	const transition = document.startViewTransition(async () => {
		themeStore.toggle();
		await tick();
	});

	void transition.finished.finally(() => {
		document.documentElement.classList.remove('theme-transitioning');
	});

	void transition.ready.then(() => {
		document.documentElement.animate(
			{
				clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
			},
			{
				duration: 500,
				easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
				pseudoElement: '::view-transition-new(root)',
			},
		);
	});
}
</script>

<Toggle.Root
  class={classes.root}
  pressed={themeStore.isDark}
  onPressedChange={() => undefined}
  onclick={handleToggle}
  aria-label="Toggle theme"
>
  <Sun class={sunIcon} />
  <Moon class={moonIcon} />
  <span class={srOnly}>Toggle theme</span>
</Toggle.Root>
