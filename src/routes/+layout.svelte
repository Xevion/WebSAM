<script lang="ts">
import '../app.css';
import { setupLogging } from '$lib/logging';
import { browser } from '$app/environment';
import { resolve } from '$app/paths';
import { themeStore } from '$lib/stores/theme.svelte';
import ThemeToggle from '$lib/components/theme-toggle.svelte';
import Button from '$lib/components/ui/button.svelte';
import Github from '@lucide/svelte/icons/github';
import Menu from '@lucide/svelte/icons/menu';
import LogoIcon from '$lib/components/logo-icon.svelte';
import { breakpoint } from '$lib/stores/breakpoint.svelte';
import { mobileUI } from '$lib/stores/app-state.svelte';
import type { Snippet } from 'svelte';
import { css } from 'styled-system/css';
import ToastContainer from '$lib/components/ui/toast.svelte';

let { children }: { children: Snippet } = $props();

if (browser) setupLogging();
themeStore.init();

function faviconSVG(isDark: boolean): string {
	const body = isDark ? ['#FB7185', '#C084FC'] : ['#E11D48', '#7C3AED'];
	const f = isDark ? ['#C4B5FD', '#DDD6FE'] : ['#A78BFA', '#C4B5FD'];
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="38 38 136 124"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${body[0]}"/><stop offset="100%" stop-color="${body[1]}"/></linearGradient></defs><path d="M50,40 L140,40 Q155,40 155,55 L155,100 L125,100 L125,130 L95,130 L95,160 L55,160 Q40,160 40,145 L40,55 Q40,40 55,40 Z" fill="url(#g)"/><rect x="130" y="104" width="20" height="20" rx="3" fill="${f[0]}" opacity="0.85"/><rect x="156" y="96" width="16" height="16" rx="3" fill="${f[1]}" opacity="0.7"/><rect x="100" y="136" width="18" height="18" rx="3" fill="${f[1]}" opacity="0.75"/><rect x="130" y="132" width="14" height="14" rx="3" fill="${f[0]}" opacity="0.6"/><rect x="154" y="122" width="12" height="12" rx="3" fill="${f[1]}" opacity="0.5"/><rect x="148" y="150" width="10" height="10" rx="2" fill="${f[0]}" opacity="0.4"/></svg>`;
}

const faviconHref = $derived(
	'data:image/svg+xml,' + encodeURIComponent(faviconSVG(themeStore.isDark)),
);

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
	color: 'fg',
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

const menuBtn = css({
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	w: '8',
	h: '8',
	borderRadius: 'md',
	cursor: 'pointer',
	border: 'none',
	bg: 'transparent',
	color: 'fg.muted',
	_hover: { bg: 'bg.muted', color: 'fg' },
});
</script>

<svelte:head>
  <title>WebSAM</title>
  <meta name="description" content="Segment Anything in the browser with WebGPU" />
  <link rel="icon" type="image/svg+xml" href={faviconHref} />
</svelte:head>

<div class={layout}>
  <header class={header}>
    <div class={headerInner}>
      {#if breakpoint.isMobileOrTablet}
        <button
          class={menuBtn}
          onclick={() => { mobileUI.drawerOpen = !mobileUI.drawerOpen; }}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      {/if}
      <a href={resolve('/')} class={logoLink}>
        <LogoIcon size={22} />
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

<ToastContainer />
