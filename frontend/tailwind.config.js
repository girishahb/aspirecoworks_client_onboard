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
    },
  },
  plugins: [],
}
