/** 
 * @type {import('tailwindcss').Config}
 */
const config = {
  content: [
    "./src/**/*.{html,js,svelte,ts}",
    "./node_modules/tw-elements/dist/js/**/*.js"
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [require("tw-elements/dist/plugin.cjs")]
}

module.exports = config
