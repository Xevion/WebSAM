import { toggleAnatomy } from '@ark-ui/svelte/anatomy';
import { defineSlotRecipe } from '@pandacss/dev';

export const toggleRecipe = defineSlotRecipe({
	className: 'toggle',
	slots: toggleAnatomy.keys(),
	base: {
		root: {
			display: 'inline-flex',
			alignItems: 'center',
			justifyContent: 'center',
			borderRadius: 'md',
			cursor: 'pointer',
			outline: 'none',
			border: 'none',
			transition: 'all',
			transitionDuration: '150ms',
			position: 'relative',
			_disabled: { opacity: 0.5, pointerEvents: 'none' },
			_focusVisible: {
				outlineWidth: '2px',
				outlineColor: 'primary',
				outlineOffset: '2px',
				outlineStyle: 'solid',
			},
		},
		indicator: {},
	},
	variants: {
		variant: {
			outline: {
				root: {
					bg: 'transparent',
					color: 'fg',
					borderWidth: '1px',
					borderColor: 'border',
					_hover: { bg: 'bg.muted' },
					_pressed: { bg: 'bg.muted', borderColor: 'border.strong' },
				},
			},
			ghost: {
				root: {
					bg: 'transparent',
					color: 'fg',
					_hover: { bg: 'bg.muted' },
					_pressed: { bg: 'bg.emphasis' },
				},
			},
		},
		size: {
			sm: { root: { h: '8', w: '8' } },
			md: { root: { h: '9', w: '9' } },
			lg: { root: { h: '10', w: '10' } },
		},
	},
	defaultVariants: {
		variant: 'outline',
		size: 'md',
	},
});
