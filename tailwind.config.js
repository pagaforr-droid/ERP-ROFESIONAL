/** @type {import('tailwindcss').Config} */

export default {

  content: [

    "./index.html",

    "./**/*.{js,ts,jsx,tsx}",

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
