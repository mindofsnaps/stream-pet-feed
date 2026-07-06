/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pet photos are served from the Supabase public CDN. We render them with
  // plain <img> (not next/image) on purpose — the overlay and gallery want the
  // raw URL with zero optimization indirection — so no remotePatterns are
  // needed. Kept here as the one place to add image config if that changes.
  reactStrictMode: true,
};

export default nextConfig;
