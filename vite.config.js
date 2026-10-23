import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 8080 is the console's port and 8081 the marketing site's default, so
    // this app takes 8082 (the server's default WORKSPACE_ORIGIN).
    port: 8082,
    strictPort: true,
  },
});
