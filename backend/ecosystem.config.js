// PM2 process manager config — used on Hostinger to keep the server running
module.exports = {
  apps: [
    {
      name: 'healthcare-crm-api',
      script: 'src/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
  ],
};
