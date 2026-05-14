/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Class-based dark mode so we can persist the user's choice in localStorage
  // and avoid flashes by applying the class before React hydrates.
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '1rem'
    },
    extend: {
      // Semantic color tokens driven by CSS variables in index.css. Same key
      // names work in light + dark, only the variable values change.
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-fg': 'rgb(var(--muted-fg) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-fg': 'rgb(var(--primary-fg) / <alpha-value>)',
        'primary-soft': 'rgb(var(--primary-soft) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        'success-fg': 'rgb(var(--success-fg) / <alpha-value>)',
        'success-soft': 'rgb(var(--success-soft) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        'warning-fg': 'rgb(var(--warning-fg) / <alpha-value>)',
        'warning-soft': 'rgb(var(--warning-soft) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        'danger-fg': 'rgb(var(--danger-fg) / <alpha-value>)',
        'danger-soft': 'rgb(var(--danger-soft) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        'info-fg': 'rgb(var(--info-fg) / <alpha-value>)',
        'info-soft': 'rgb(var(--info-soft) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)'
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem'
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.06)',
        floating:
          '0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10), 0 12px 24px -8px rgb(0 0 0 / 0.10)'
      },
      keyframes: {
        in: {
          from: { opacity: 0, transform: 'translateY(4px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        },
        'fade-in': {
          from: { opacity: 0 },
          to: { opacity: 1 }
        },
        'overlay-in': {
          from: { opacity: 0 },
          to: { opacity: 1 }
        },
        'modal-in': {
          from: { opacity: 0, transform: 'translate(-50%, -48%) scale(0.97)' },
          to: { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        in: 'in 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'fade-in': 'fade-in 150ms ease-out both',
        'overlay-in': 'overlay-in 150ms ease-out both',
        'modal-in': 'modal-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        shimmer: 'shimmer 1.6s linear infinite'
      }
    }
  },
  plugins: []
};
