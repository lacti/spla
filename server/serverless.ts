import type { AWS } from "@serverless/typescript";

const config: AWS = {
  service: "spla-server",
  frameworkVersion: "3",
  provider: {
    name: "aws",
    runtime: "nodejs18.x",
    region: "ap-northeast-2",
    environment: {
      REDIS_HOST: process.env.REDIS_HOST!,
      REDIS_PORT: process.env.REDIS_PORT!,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD!,
    },
  },
  functions: {
    handleConnect: {
      handler: "handler.handleConnect",
      events: [{ websocket: { route: "$connect" } }],
    },
    handleDisconnect: {
      handler: "handler.handleDisconnect",
      events: [{ websocket: { route: "$disconnect" } }],
    },
    handleMessage: {
      handler: "handler.handleMessage",
      events: [{ websocket: { route: "$default" } }],
    },
  },
  plugins: ["serverless-esbuild", "serverless-offline"],
  custom: {
    esbuild: {
      bundle: true,
      minify: true,
      sourcemap: true,
      exclude: ["@aws-sdk"],
      target: "node18",
    },
  },
};

export = config;
