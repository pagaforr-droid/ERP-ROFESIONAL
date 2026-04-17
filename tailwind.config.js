/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <-- Aquí está la corrección (se añadió 'src/')
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
