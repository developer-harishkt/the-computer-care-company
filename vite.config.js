import { defineConfig, loadEnv } from 'vite';

/** Substitute %VITE_SITE_URL% in HTML heads and JSON-LD at build (and dev). */
function siteUrlHtmlPlugin(siteUrl) {
  return {
    name: 'html-site-url',
    transformIndexHtml(html) {
      return html.replaceAll('%VITE_SITE_URL%', siteUrl);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = env.VITE_SITE_URL || 'https://YOUR-DOMAIN';

  return {
    plugins: [siteUrlHtmlPlugin(siteUrl)],
    server: {
      // Lets co-founder preview via ngrok / localtunnel / Cloudflare quick tunnel
      allowedHosts: ['.loca.lt', '.ngrok-free.app', '.ngrok.io', '.trycloudflare.com'],
    },
    build: {
      rollupOptions: {
        input: {
          main: 'index.html',
          schedule: 'schedule-visit.html',
          book: 'book.html',
          privacy: 'privacy.html',
          terms: 'terms.html',
          about: 'about.html',
        },
      },
    },
  };
});