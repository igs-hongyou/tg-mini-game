import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this project from https://<user>.github.io/tg-mini-game/,
  // so production asset URLs need that subpath prefix. Dev server stays at '/'.
  base: command === 'build' ? '/tg-mini-game/' : '/',
  plugins: [react()],
}))
