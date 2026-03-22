import { browser } from '$app/environment';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function createBreakpointStore() {
	let current = $state<Breakpoint>('desktop');

	if (browser) {
		const mqTablet = matchMedia('(min-width: 768px)');
		const mqDesktop = matchMedia('(min-width: 1024px)');

		function update() {
			if (mqDesktop.matches) {
				current = 'desktop';
			} else if (mqTablet.matches) {
				current = 'tablet';
			} else {
				current = 'mobile';
			}
		}

		update();
		mqTablet.addEventListener('change', update);
		mqDesktop.addEventListener('change', update);
	}

	return {
		get current() {
			return current;
		},
		get isMobile() {
			return current === 'mobile';
		},
		get isTablet() {
			return current === 'tablet';
		},
		get isDesktop() {
			return current === 'desktop';
		},
		get isMobileOrTablet() {
			return current !== 'desktop';
		},
	};
}

export const breakpoint = createBreakpointStore();
