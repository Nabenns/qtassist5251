/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Match the bot's QTrades branding palette loosely.
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#b6d4ff',
          300: '#83b6ff',
          400: '#4f8eff',
          500: '#2a6bf2',
          600: '#1d52d4',
          700: '#1a44ab',
          800: '#1a3a87',
          900: '#1b346b'
        }
      }
    }
  },
  plugins: []
};
