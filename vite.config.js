import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 8080 is the console's port (and alcoiaServer's WEB_APP_ORIGIN /
    // CONSOLE_ORIGIN defaults), so this app takes 8081. alcoiaServer's CORS
    // does not allow this origin yet -- see CLAUDE.md "Known gaps".
    port: 8081,
    strictPort: true,
  },
});
