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
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-slight': {
          '0%, 100%': { transform: 'translateY(-5%)' },
          '50%': { transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'slide-up': 'slide-up 0.3s ease-out forwards',
        'bounce-slight': 'bounce-slight 2s infinite ease-in-out',
      }
    }
  },
  plugins: [],
}
