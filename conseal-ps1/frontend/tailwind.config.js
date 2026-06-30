/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Match the Conseal site palette.
        ink: '#0F172A',        // primary text / nav
        accent: '#2563EB',     // brand blue
        'accent-soft': '#EEF2FF',
        canvas: '#F8FAFC',     // page background
        rule: '#E2E8F0',       // hairline borders
        muted: '#64748B',      // secondary text
      },
      fontFamily: {
        // System sans for body; the wordmark uses a heavy weight to mimic Conseal.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
}
