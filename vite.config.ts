import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

function createGroqMiddleware(env: Record<string, string>) {
  return (req: any, res: any) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }

    const useCapsule = req.headers['x-capsule-ai'] === 'true';
    const apiKey = (useCapsule ? env.CAPSULE_GROQ_API_KEY : env.GROQ_API_KEY) || env.GROQ_API_KEY || process.env.GROQ_API_KEY || '';

    if (!apiKey) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'GROQ_API_KEY is not defined in your server-side environment or .env' } }));
      return;
    }

    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', async () => {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body,
        });

        res.statusCode = response.status;
        res.setHeader('Content-Type', 'application/json');
        const data = await response.text();
        res.end(data);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
    });
  };
}

function createGeminiMiddleware(env: Record<string, string>) {
  return (req: any, res: any) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }

    const useCapsule = req.headers['x-capsule-ai'] === 'true';
    const apiKey = (useCapsule ? env.CAPSULE_GEMINI_API_KEY : env.GEMINI_API_KEY) || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'GEMINI_API_KEY is not defined in your server-side environment or .env' } }));
      return;
    }

    const urlPath = req.url || '';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta${urlPath}?key=${apiKey}`;

    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', async () => {
      try {
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body,
        });

        res.statusCode = response.status;
        res.setHeader('Content-Type', 'application/json');
        const data = await response.text();
        res.end(data);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
    });
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-proxy-middleware',
        configureServer(server) {
          server.middlewares.use('/api/groq', createGroqMiddleware(env));
          server.middlewares.use('/api/gemini', createGeminiMiddleware(env));
        },
        configurePreviewServer(server) {
          server.middlewares.use('/api/groq', createGroqMiddleware(env));
          server.middlewares.use('/api/gemini', createGeminiMiddleware(env));
        },
      },
    ],
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
