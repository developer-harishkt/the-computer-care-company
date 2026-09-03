/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          950: '#08101D', // Premium deep navy – hero & footer anchor
          900: '#0B192C', // Deep navy for dark text
          800: '#1E3E62', // Secondary deep blue
          blue: '#3182CE', // Vibrant engineering blue
          light: '#F8FAFC', // Soft off-white mid-section background
          card: '#FFFFFF',  // Pure white cards
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