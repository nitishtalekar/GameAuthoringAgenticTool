import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling LangChain packages for the browser.
  // These are server-only and must be required natively at runtime.
  serverExternalPackages: [
    "@langchain/core",
    "@langchain/openai",
    "@langchain/google-genai",
    "@langchain/langgraph",
  ],

  // Turbopack is the default dev bundler in Next.js 16.
  // An empty config here tells Next.js we've acknowledged it,
  // suppressing the warning about the webpack config below.
  turbopack: {},

  // Used by `next build` (webpack-based production build).
  // Prevents LangChain from being bundled into the browser bundle.
  // Prevents Phaser from being imported in the Node.js server bundle.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@langchain/core": false,
        "@langchain/openai": false,
        "@langchain/google-genai": false,
        "@langchain/langgraph": false,
      };
    }
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        phaser: false,
      };
    }
    return config;
  },
};

export default nextConfig;
