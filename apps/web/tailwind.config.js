import path from 'node:path';
import { fileURLToPath } from 'node:url';
import preset from '../shared/ui/tailwind.preset.js';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    path.resolve(rootDir, '../shared/ui/**/*.{js,ts,jsx,tsx}'),
  ],
  presets: [preset],
  theme: {
    extend: {},
  },
  plugins: [],
};
