import Script from "next/script";

// Public by design: Cloudflare's snippet puts it in every page's HTML.
const CLOUDFLARE_BEACON_TOKEN = "632e172cc3aa4a2bb3d43300e9622781";

/**
 * Cloudflare Web Analytics (free page-view counts). Added by hand because
 * Cloudflare's automatic injection does not apply to Worker responses.
 * Production only, store pages only (the admin's own visits stay out), and
 * loaded when the browser is idle so it never competes with the LCP image.
 */
export function WebAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token: CLOUDFLARE_BEACON_TOKEN })}
      strategy="lazyOnload"
    />
  );
}
