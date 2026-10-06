/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        gold: {
          50: '#fbf8ea',
          100: '#f5eecc',
          200: '#eddca0',
          300: '#e3c46e',
          400: '#d9ac42',
          500: '#c59325',
          600: '#a7731d',
          700: '#84531b',
          800: '#6f431c',
          900: '#5f381c',
        }
      },
      fontFamily: {
        sans: ['Tajawal', 'Cairo', 'system-ui', '-apple-system', 'sans-serif'],
        arabic: ['Tajawal', 'Cairo', 'sans-serif']
      }
    },
  },
  plugins: [],
}
