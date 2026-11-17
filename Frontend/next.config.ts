import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: process.env.MOTORMATE_STANDALONE === "1" ? "standalone" : undefined,
    async headers() {
        return [{
            source: "/handoff-upload/:token",
            headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
        }];
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "res.cloudinary.com",
            },
        ],
    },
};

export default nextConfig;
