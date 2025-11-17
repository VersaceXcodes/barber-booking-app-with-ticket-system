/// <reference types="vite/client" />

// Runtime configuration injected via index.html
interface Window {
  __RUNTIME_CONFIG__?: {
    API_BASE_URL: string;
  };
}
