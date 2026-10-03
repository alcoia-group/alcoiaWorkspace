import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 8080 is the console's port and 8081 alcoiaServer's marketing-site
    // default, so this app takes 8082 (alcoiaServer's READER_ORIGIN default). alcoiaServer's CORS
    // does not allow this origin yet -- see CLAUDE.md "Known gaps".
    port: 8082,
    strictPort: true,
  },
});
