/** @type {import('tailwindcss').Config} */
export default {
  // Define que o modo escuro é manual (via classe CSS) e não automático pelo sistema
  darkMode: 'class', 
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}