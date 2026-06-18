module.exports = {
  apps: [
    {
      name: "peak-backend",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "development",
        PORT: 7001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 7001,
      },
    },
  ],
};
