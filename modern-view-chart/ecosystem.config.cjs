module.exports = {
  apps: [
    {
      name: "vivutrade-prod",
      cwd: "d:/viewx/ViewX/modern-view-chart",
      script: "npm.cmd",
      args: "run start",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "0.0.0.0",
        PORT: "3000"
      }
    }
  ]
};
