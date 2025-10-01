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
              headers: {
                "Content-Type": assetResponse.headers.get("Content-Type") || "image/png",
                "Content-Length": assetResponse.headers.get("Content-Length") || "",
              },
            });
          }
          return assetResponse;
        }
      }
      return new Response(null, { status: request.method === "HEAD" ? 200 : 204 });
    }

    if (assetsBinding?.fetch) {
      const assetResponse = await assetsBinding.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;

      if (request.method === "GET" && !url.pathname.includes(".")) {
        const indexRequest = new Request(new URL("/index.html", url), request);
        return assetsBinding.fetch(indexRequest);
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
