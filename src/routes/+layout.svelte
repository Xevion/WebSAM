<script lang="ts">
import '../app.css';
import { themeStore } from '$lib/stores/theme.svelte';
import ThemeToggle from '$lib/components/theme-toggle.svelte';
import Button from '$lib/components/ui/button.svelte';
import Github from '@lucide/svelte/icons/github';
import Layers from '@lucide/svelte/icons/layers';
import type { Snippet } from 'svelte';
import { css } from 'styled-system/css';

let { children }: { children: Snippet } = $props();

themeStore.init();

const layout = css({
	display: 'flex',
	flexDirection: 'column',
	h: '100vh',
	bg: 'bg',
	color: 'fg',
});

const header = css({
	position: 'sticky',
	top: '0',
	zIndex: '50',
	w: 'full',
	borderBottomWidth: '1px',
	borderColor: 'border',
	bg: 'bg/95',
	backdropFilter: 'blur(8px)',
});

const headerInner = css({
	display: 'flex',
	h: '12',
	alignItems: 'center',
	justifyContent: 'space-between',
	px: '4',
});

const logoLink = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	fontWeight: 'bold',
	fontSize: 'lg',
	textDecoration: 'none',
});

const logoText = css({
	background: 'linear-gradient(to right, {colors.indigo.400}, {colors.indigo.600})',
	backgroundClip: 'text',
	color: 'transparent',
});

const logoIcon = css({
	color: 'primary',
});

const main = css({
	flex: '1',
	overflow: 'hidden',
});

const navActions = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
});
</script>

<svelte:head>
  <title>WebSAM - Segment Anything in the Browser</title>
  <meta name="description" content="Browser-based Segment Anything Model demo with WebGPU acceleration" />
</svelte:head>

<div class={layout}>
  <header class={header}>
    <div class={headerInner}>
      <a href="/" class={logoLink}>
        <Layers size={20} class={logoIcon} />
        <span class={logoText}>WebSAM</span>
      </a>
      <div class={navActions}>
        <Button href="https://github.com/Xevion/WebSAM" variant="ghost" size="icon-sm" target="_blank" rel="noopener">
          <Github size={16} />
        </Button>
        <ThemeToggle />
      </div>
    </div>
  </header>

  <main class={main}>
    {@render children()}
  </main>
</div>
