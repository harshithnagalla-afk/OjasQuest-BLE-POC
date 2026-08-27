import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: Web Bluetooth requires a secure context. `localhost` is exempted by
// browsers, so plain `npm run dev` is fine locally. Any deployed version of
// this app MUST be served over HTTPS or the "Connect Device" button will
// silently do nothing (navigator.bluetooth won't exist).
export default defineConfig({
  plugins: [react()],
});
