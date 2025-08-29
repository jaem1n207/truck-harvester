/** @type {import("prettier").Config} & import('prettier-plugin-tailwindcss').PluginOptions} */
module.exports = {
  semi: false,
  trailingComma: 'es5',
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  printWidth: 80,
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  overrides: [
    {
      files: '*.{ts,tsx}',
      options: {
        parser: 'typescript',
      },
    },
    {
      files: '*.{js,jsx}',
      options: {
        parser: 'babel',
      },
    },
    {
      files: '*.json',
      options: {
        parser: 'json',
        tabWidth: 2,
      },
    },
    {
      files: '*.md',
      options: {
        parser: 'markdown',
        printWidth: 100,
        proseWrap: 'preserve',
      },
    },
  ],
  plugins: ['prettier-plugin-tailwindcss'],
}
