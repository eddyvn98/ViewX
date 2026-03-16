# Git Push Docker Deploy

Muc tieu: may nay dong vai tro may deploy. Mot may khac se la noi code, va moi lan can cap nhat chi can `git push` sang may deploy de may nay tu rebuild Docker.

## Luong hoat dong

1. May deploy tao mot bare repo Git de nhan code.
2. Sau moi lan push vao branch `main`, hook `post-receive` se chay.
3. Hook se checkout code moi vao thu muc du an hien tai.
4. Hook goi `scripts/server/docker-up.ps1` de rebuild va restart stack Docker.

## Chuan bi tren may deploy

1. Tao file env Docker:

```powershell
Copy-Item .env.docker.example .env.docker
```

2. Chay script setup:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\setup-git-deploy.ps1
```

Mac dinh script se tao bare repo tai `D:\git-remotes\modern-view-chart.git`.

## Cau hinh tren may code

Them remote tro toi may deploy qua SSH:

```bash
git remote add deploy ssh://<deploy-user>@<deploy-host>/D:/git-remotes/modern-view-chart.git
```

Neu da co remote `deploy`, cap nhat lai:

```bash
git remote set-url deploy ssh://<deploy-user>@<deploy-host>/D:/git-remotes/modern-view-chart.git
```

Hoac dung script de setup 1 lan:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\setup-code-machine-deploy.ps1 -DeployHost <deploy-host> -DeployUser <deploy-user>
```

Script tren se:

- tao hoac cap nhat remote `deploy`
- tao git alias `ship`

## Deploy

Tu may code:

```bash
git push deploy main
```

Neu da chay setup 1 lan o tren, tu may code ve sau chi can:

```bash
git ship
```

Hoac neu thich bam file/script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\push-deploy.ps1
```

Sau khi push thanh cong, may deploy se:

- checkout commit moi vao `D:\viewx\ViewX\modern-view-chart`
- chay `docker compose --env-file .env.docker --profile staging up -d --build`
- tu dong start lai MT5 bridge neu script bridge co san

## Log

Deploy log:

```text
logs/git-deploy.log
```

Docker logs:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\docker-logs.ps1
```

## Luu y quan trong

- Docker phai duoc bat tren may deploy truoc khi nhan push.
- `.env.docker` can ton tai san tren may deploy va khong nen push len Git.
- Hook deploy dang dung `git checkout -f` de dong bo file tracked. Khong nen sua tay file tracked tren may deploy, vi lan deploy sau se ghi de.
- Neu may code push vao branch khac `main`, hook mac dinh se khong deploy branch do.
