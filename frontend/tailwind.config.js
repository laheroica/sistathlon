/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Modo nocturno — colores base Athlon
        dark: {
          bg: '#1a1a2e',
          surface: '#16213e',
          border: '#0f3460',
          text: '#e2e8f0',
          muted: '#94a3b8',
        },
        // Primario
        primary: {
          DEFAULT: '#2563eb',
          dark: '#3b82f6',
          50: '#eff6ff',
          100: '#dbeafe',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Disciplinas
        cf: { light: '#dbeafe', dark: '#1e40af' },
        hf: { light: '#d1fae5', dark: '#065f46' },
        hyrox: { light: '#fef3c7', dark: '#92400e' },
        teens: { light: '#ede9fe', dark: '#4c1d95' },
        kids: { light: '#fce7f3', dark: '#9d174d' },
        temporal: { light: '#e0f2fe', dark: '#0369a1' },
      },
    },
  },
  plugins: [],
}
