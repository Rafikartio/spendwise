// PM2 process file. Start with:  pm2 start deploy/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'spendwise',
      cwd: __dirname + '/../server', // so dotenv finds server/.env
      script: 'src/index.js',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '300M',
      autorestart: true,
      time: true,
    },
  ],
};
