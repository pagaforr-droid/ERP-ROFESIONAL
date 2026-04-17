/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",               // Lee App.tsx o main.tsx en la raíz
    "./components/**/*.{js,ts,jsx,tsx}", // Lee todos tus componentes
    "./services/**/*.{js,ts,jsx,tsx}",   // Lee tus servicios
    "./utils/**/*.{js,ts,jsx,tsx}",      // Lee tus utilidades
    "./types/**/*.{js,ts,jsx,tsx}"       // Lee tus tipos
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: '#0f172a', // slate-900
        accent: '#2563eb', // blue-600
      }
    }
  },
  plugins: [],
}
