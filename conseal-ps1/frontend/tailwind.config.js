/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Premium Dark Theme
        ink: '#F8FAFC',        // primary text
        accent: '#3B82F6',     // brand blue (adjusted for dark mode contrast)
        'accent-soft': 'rgba(59, 130, 246, 0.12)', // translucent blue
        canvas: '#0B0F19',     // page background
        rule: 'rgba(255, 255, 255, 0.08)', // hairline borders
        muted: '#94A3B8',      // secondary text
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
