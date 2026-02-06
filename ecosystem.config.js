module.exports = {
  apps: [
    {
      name: 'snam-baitong-api',
      cwd: './backend',
      script: 'src/index.js',
      exec_mode: 'fork',
      instances: 1,

      // Give Express time to close sockets on reload
      kill_timeout: 8000,
      listen_timeout: 8000,
      max_restarts: 10,
      restart_delay: 2000,
      max_memory_restart: '512M',

      // Log timestamps in PM2 logs
      time: true,
      merge_logs: true,

      env: {
        NODE_ENV: 'development',
        HOST: '0.0.0.0',
      },
      env_production: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        // Ensure internal bot API calls target the correct port
        BACKEND_BASE_URL: 'http://127.0.0.1:3000',
      },
    },
    {
      name: 'snam-baitong-scheduler',
      cwd: './backend',
      script: 'src/scheduler.js',
      exec_mode: 'fork',
      instances: 1,
      time: true,
      merge_logs: true,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ],
};
