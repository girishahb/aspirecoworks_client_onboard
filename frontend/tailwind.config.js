/**
 * Aspire Coworks – Tailwind theme extended with brand CSS variables.
 * Use semantic names for consistent usage: primary, secondary, accent, text, muted, error, success, background, border.
 * Examples: bg-primary, text-accent, border-border, text-error, text-muted.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        background: 'var(--color-background)',
        border: 'var(--color-border)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        error: 'var(--color-error)',
        success: 'var(--color-success)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-out': { '0%': { opacity: '1', transform: 'translateY(0)' }, '100%': { opacity: '0', transform: 'translateY(-8px)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'fade-out': 'fade-out 0.2s ease-in forwards',
      },
    },
  },
  plugins: [],
}
