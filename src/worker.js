const withSecurityHeaders = (response) => {
  const secured = new Response(response.body, response);
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  secured.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  if (secured.headers.get("Content-Type")?.includes("text/html")) {
    secured.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors *"
    );
  }
  return secured;
};

export default {
  async fetch(request, env) {
    const assetsBinding = env.ASSETS;
    const url = new URL(request.url);

    if (url.pathname === "/favicon.ico") {
      if (assetsBinding?.fetch) {
        const assetRequest = new Request(new URL("/threemf.png", url), request);
        const assetResponse = await assetsBinding.fetch(assetRequest);
        if (assetResponse.status !== 404) {
          if (request.method === "HEAD") {
            return new Response(null, {
              status: 200,
              headers: assetResponse.headers,
            });
          }
          return withSecurityHeaders(assetResponse);
        }
      }
      return new Response(null, { status: request.method === "HEAD" ? 200 : 204 });
    }

    if (assetsBinding?.fetch) {
      const assetResponse = await assetsBinding.fetch(request);
      if (assetResponse.status !== 404) return withSecurityHeaders(assetResponse);

      if (request.method === "GET" && !url.pathname.includes(".")) {
        const indexRequest = new Request(new URL("/index.html", url), request);
        return withSecurityHeaders(await assetsBinding.fetch(indexRequest));
      }

      return assetResponse;
    }

    // Assets binding not configured; return minimal response
    if (request.method === "GET" && !url.pathname.includes(".")) {
      return new Response("ASSETS binding is not configured", { status: 500 });
    }

    return new Response(null, { status: 404 });
  },
};
