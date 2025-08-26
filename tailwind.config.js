/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'football-primary': '#1a472a',
        'football-secondary': '#2d5a3d',
        'football-accent': '#4ade80',
        'football-field': '#2d7a2d',
      },
      fontFamily: {
        'anton': ['Anton', 'sans-serif'],
      },
      width: {
        'main-content': '65%',
        'sidebar-right': '15%',
      }
    },
  },
  plugins: [],
}
