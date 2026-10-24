import { defineConfig } from 'vite';

// The Pages workflow supplies its actual repository path. Local development
// continues to work at the root URL.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/'
});
