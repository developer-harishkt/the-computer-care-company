/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./*.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Master dark theme palette (charcoal black #0F1115)
        brand: {
          900: '#0F1115',
          800: '#1A1D24',
          red: '#E53935',
          light: '#F8F9FA',
        },
        // Secondary/legacy theme palette (rich navy #0B192C)
        navy: {
          900: '#0B192C',
          950: '#08101D',
          800: '#1E3E62',
          red: '#E53E3E',
          blue: '#3182CE',
          light: '#F8FAFC',
          canvas: '#EEF2F7',
          surface: '#F7F9FC',
          zebra: '#FAFBFD',
          card: '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}