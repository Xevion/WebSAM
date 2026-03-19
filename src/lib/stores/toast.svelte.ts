import { createToaster } from '@ark-ui/svelte/toast';

export const toaster = createToaster({
	placement: 'bottom-end',
	duration: 4000,
	removeDelay: 200,
	max: 5,
	gap: 12,
	offsets: '1rem',
});
