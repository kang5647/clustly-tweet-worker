// pm2 config — run with: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "clustly-tweet-worker",
      script: "dist/worker.js",
      node_args: "--experimental-vm-modules",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 50,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
      // Log rotation
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
    },
  ],
};
