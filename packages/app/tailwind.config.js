/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/server/views/**/*.ejs', './src/server/public/**/*.html'],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['light', 'dark', 'cupcake'],
    base: true,
    styled: true,
    utils: true,
  },
}
