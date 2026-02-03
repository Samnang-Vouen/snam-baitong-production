/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {},
  },
  // Keep Tailwind utilities without resetting Bootstrap / existing CSS
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
