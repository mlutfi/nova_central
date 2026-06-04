module.exports = {
  apps: [
    {
      name: 'nova-central-backend',
      cwd: './backend',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'nova-central-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4300',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
