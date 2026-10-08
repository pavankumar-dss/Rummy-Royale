import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build works under any sub-path,
  // e.g. https://<user>.github.io/Rummy-Royale/
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
