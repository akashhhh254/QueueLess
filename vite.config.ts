import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Harmonize Firebase variables across common Vercel naming conventions
  const apiKey = (
    env.VITE_FIREBASE_API_KEY ||
    env.FIREBASE_API_KEY ||
    env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    ''
  ).trim();

  const authDomain = (
    env.VITE_FIREBASE_AUTH_DOMAIN ||
    env.FIREBASE_AUTH_DOMAIN ||
    process.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'queue-69233.firebaseapp.com'
  ).trim();

  const projectId = (
    env.VITE_FIREBASE_PROJECT_ID ||
    env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'queue-69233'
  ).trim();

  const storageBucket = (
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'queue-69233.firebasestorage.app'
  ).trim();

  const messagingSenderId = (
    env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    env.FIREBASE_MESSAGING_SENDER_ID ||
    process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    '6519985210'
  ).trim();

  const appId = (
    env.VITE_FIREBASE_APP_ID ||
    env.FIREBASE_APP_ID ||
    process.env.VITE_FIREBASE_APP_ID ||
    '1:6519985210:web:c1589adf316a8ac8f45103'
  ).trim();

  const measurementId = (
    env.VITE_FIREBASE_MEASUREMENT_ID ||
    env.FIREBASE_MEASUREMENT_ID ||
    process.env.VITE_FIREBASE_MEASUREMENT_ID ||
    'G-3M53ZYET9F'
  ).trim();

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(authDomain),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(projectId),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(storageBucket),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(messagingSenderId),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(appId),
      'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(measurementId),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
