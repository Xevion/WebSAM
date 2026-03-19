import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
	if (!browser) return 'light';

	if (document.documentElement.classList.contains('dark')) {
		return 'dark';
	}
	if (document.documentElement.classList.contains('light')) {
		return 'light';
	}

	const stored = localStorage.getItem('theme');
	if (stored === 'dark' || stored === 'light') {
		return stored;
	}

	if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	}

	return 'light';
}

function createThemeStore() {
	let theme = $state<Theme>(getInitialTheme());

	function init() {
		if (!browser) return;

		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
			if (!localStorage.getItem('theme')) {
				theme = e.matches ? 'dark' : 'light';
				applyTheme();
			}
		});
	}

	function applyTheme() {
		if (!browser) return;
		document.documentElement.classList.toggle('dark', theme === 'dark');
	}

	function toggle() {
		theme = theme === 'dark' ? 'light' : 'dark';
		if (browser) {
			localStorage.setItem('theme', theme);
		}
		applyTheme();
	}

	function set(newTheme: Theme) {
		theme = newTheme;
		if (browser) {
			localStorage.setItem('theme', newTheme);
		}
		applyTheme();
	}

	return {
		get current() {
			return theme;
		},
		get isDark() {
			return theme === 'dark';
		},
		init,
		toggle,
		set,
	};
}

export const themeStore = createThemeStore();
