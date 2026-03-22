<script lang="ts">
import { themeStore } from '$lib/stores/theme.svelte';

let { size = 20, class: className = '' }: { size?: number; class?: string } = $props();

const id = `lg-${Math.random().toString(36).slice(2, 8)}`;

const bodyGrad = $derived(
	themeStore.isDark ? ['#FB7185', '#C084FC'] : ['#E11D48', '#7C3AED'],
);
const frag = $derived(
	themeStore.isDark ? ['#C4B5FD', '#DDD6FE'] : ['#A78BFA', '#C4B5FD'],
);
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="38 38 136 124"
  width={size}
  height={size * (124 / 136)}
  class={className}
>
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color={bodyGrad[0]} />
      <stop offset="100%" stop-color={bodyGrad[1]} />
    </linearGradient>
  </defs>
  <path
    d="M50,40 L140,40 Q155,40 155,55 L155,100 L125,100 L125,130 L95,130 L95,160 L55,160 Q40,160 40,145 L40,55 Q40,40 55,40 Z"
    fill="url(#{id})"
  />
  <rect x="130" y="104" width="20" height="20" rx="3" fill={frag[0]} opacity="0.85" />
  <rect x="156" y="96" width="16" height="16" rx="3" fill={frag[1]} opacity="0.70" />
  <rect x="100" y="136" width="18" height="18" rx="3" fill={frag[1]} opacity="0.75" />
  <rect x="130" y="132" width="14" height="14" rx="3" fill={frag[0]} opacity="0.60" />
  <rect x="154" y="122" width="12" height="12" rx="3" fill={frag[1]} opacity="0.50" />
  <rect x="148" y="150" width="10" height="10" rx="2" fill={frag[0]} opacity="0.40" />
</svg>
