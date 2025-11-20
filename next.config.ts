import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Suppress source map warnings in development
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  
  webpack(config, { dev, isServer }) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    
    // Suppress source map warnings for node-cron
    if (dev && !isServer) {
      config.ignoreWarnings = [
        { module: /node-cron/ },
        /Failed to parse source map/,
      ];
    }
    
    return config;
  },
    
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
};

export default nextConfig;
