param(
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$AppDir = "D:\viewx\ViewX\modern-view-chart"

Set-Location $AppDir

git fetch origin $Branch
git checkout $Branch
git pull --ff-only origin $Branch

# Keep exact workflow requested
npm install
npm run build

if (pm2 describe viewx-backend-semi *> $null) {
  pm2 restart viewx-backend-semi
} else {
  pm2 start "$AppDir\deploy\semi-prod\start-backend-semi.mjs" --name viewx-backend-semi
}

if (pm2 describe viewx-frontend-semi *> $null) {
  pm2 restart viewx-frontend-semi
} else {
  pm2 start "$AppDir\deploy\semi-prod\start-frontend-semi.mjs" --name viewx-frontend-semi
}

if (pm2 describe viewx-cloudflared-host *> $null) {
  pm2 restart viewx-cloudflared-host
} else {
  pm2 start "$AppDir\deploy\semi-prod\start-cloudflared-host.mjs" --name viewx-cloudflared-host
}

if (pm2 describe viewx-bridge-semi *> $null) {
  pm2 restart viewx-bridge-semi
} else {
  pm2 start "$AppDir\deploy\semi-prod\start-bridge-semi.mjs" --name viewx-bridge-semi
}

pm2 save
