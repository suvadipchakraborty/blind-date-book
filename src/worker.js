/**
 * Blind Date with a Book — Cloudflare Worker
 *
 * The app itself is a static site (HTML/CSS/vanilla JS) that talks
 * directly to the Open Library API from the browser. This Worker's only
 * job is to serve those static files via the Cloudflare Workers "Static
 * Assets" binding configured in wrangler.toml ([assets] directory =
 * "public"), with a small amount of routing so a PWA with client-side
 * navigation always falls back to index.html.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      // Let the assets binding serve the exact file if it exists
      // (html, css, js, manifest, icons, sw.js, etc).
      const assetResponse = await env.ASSETS.fetch(request);

      if (assetResponse.status !== 404) {
        return withSecurityHeaders(assetResponse);
      }

      // Single-page fallback: unknown paths (e.g. a deep link) get the
      // app shell so client-side JS can take over.
      const indexUrl = new URL("/index.html", url.origin);
      const fallback = await env.ASSETS.fetch(new Request(indexUrl, request));
      return withSecurityHeaders(fallback);
    } catch (err) {
      return new Response("Blind Date with a Book is taking a quick breather. Please try again.", {
        status: 500,
        headers: { "content-type": "text/plain; charset=UTF-8" },
      });
    }
  },
};

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
