import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // VITE_BASE_PATH is injected by the deploy workflow (/sales-/).
  // Falls back to / for local dev and the CI build check.
  base: process.env.VITE_BASE_PATH ?? '/',
})
