<script lang="ts">
import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';
import { button } from 'styled-system/recipes';
import { cx } from 'styled-system/css';

type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'danger' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

interface SharedProps {
	variant?: ButtonVariant;
	size?: ButtonSize;
	disabled?: boolean;
	class?: string;
}

type Props =
	| (HTMLAnchorAttributes & SharedProps & { href: string })
	| (HTMLButtonAttributes & SharedProps & { href?: never });

let {
	variant = 'solid',
	size = 'md',
	href,
	disabled = false,
	class: className = '',
	children,
	...restProps
}: Props = $props();

const classes = $derived(cx(button({ variant, size }), className));
</script>

{#if href}
  <a
    {href}
    class={classes}
    aria-disabled={disabled || undefined}
    {...restProps as HTMLAnchorAttributes}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    class={classes}
    {disabled}
    type="button"
    {...restProps as HTMLButtonAttributes}
  >
    {@render children?.()}
  </button>
{/if}
