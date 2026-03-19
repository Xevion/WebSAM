import { defineRecipe } from '@pandacss/dev';

export const buttonRecipe = defineRecipe({
	className: 'button',
	description: 'Button component styles',
	base: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: '2',
		borderRadius: 'lg',
		fontSize: 'sm',
		fontWeight: 'semibold',
		letterSpacing: '0.01em',
		whiteSpace: 'nowrap',
		transition: 'all',
		transitionDuration: '200ms',
		transitionTimingFunction: 'ease-out',
		cursor: 'pointer',
		userSelect: 'none',
		outline: 'none',
		border: 'none',
		textDecoration: 'none',
		_disabled: { opacity: 0.5, pointerEvents: 'none', shadow: 'none' },
		_focusVisible: {
			outlineWidth: '2px',
			outlineColor: 'primary',
			outlineOffset: '2px',
			outlineStyle: 'solid',
		},
		_active: { transform: 'scale(0.97)' },
		'& svg': {
			pointerEvents: 'none',
			flexShrink: 0,
			width: '1em',
			height: '1em',
		},
	},
	variants: {
		variant: {
			solid: {
				bg: 'primary',
				color: 'primary.fg',
				shadow: 'sm',
				_hover: {
					bg: 'primary.hover',
					shadow: 'md',
				},
			},
			outline: {
				bg: 'transparent',
				color: 'fg',
				borderWidth: '1px',
				borderColor: 'border',
				_hover: {
					bg: 'bg.muted',
					borderColor: 'fg.muted',
				},
			},
			ghost: {
				bg: 'transparent',
				color: 'fg',
				_hover: { bg: 'bg.muted' },
			},
			danger: {
				bg: 'danger',
				color: 'danger.fg',
				shadow: 'sm',
				_hover: {
					shadow: 'md',
					opacity: '0.9',
				},
			},
			link: {
				bg: 'transparent',
				color: 'primary',
				_hover: { textDecoration: 'underline' },
				p: '0',
				h: 'auto',
			},
		},
		size: {
			sm: { h: '8', px: '3', fontSize: 'xs' },
			md: { h: '10', px: '5', fontSize: 'sm' },
			lg: { h: '12', px: '6', fontSize: 'md' },
			icon: { h: '10', w: '10', p: '0' },
			'icon-sm': { h: '8', w: '8', p: '0' },
		},
	},
	defaultVariants: {
		variant: 'solid',
		size: 'md',
	},
});
