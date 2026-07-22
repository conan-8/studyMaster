/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        // Serve the unpacked Bluebook document as the site root so `/` IS the
        // exam HTML directly (no redirect, no meta-refresh flash). beforeFiles
        // runs before page routing, so this wins over src/app/page.tsx.
        { source: "/", destination: "/exam/index.html" },
      ],
      afterFiles: [
        // Next.js serves public/exam/index.html at /exam/index.html but not at
        // the pretty URL /exam (no directory-index resolution for public/).
        { source: "/exam", destination: "/exam/index.html" },
        { source: "/exam-csa", destination: "/exam-csa/index.html" },
      ],
    };
  },
};

export default nextConfig;
