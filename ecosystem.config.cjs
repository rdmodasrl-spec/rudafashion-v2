const path = require('path');

module.exports = {
  apps: [{
    name: 'ruda-fashion',
    script: './dist/server.cjs',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    time: true,
    env: {
      NODE_ENV: 'production',
      PORT: 3011,
      COMPAT_PORT: 3000
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true
  }, {
    name: 'openmontage-backlot',
    script: '.venv/bin/python',
    args: '-m backlot serve --port 4750',
    cwd: path.join(__dirname, 'OpenMontage'),
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './OpenMontage/logs/backlot-error.log',
    out_file: './OpenMontage/logs/backlot-out.log',
    merge_logs: true
  }]
};
