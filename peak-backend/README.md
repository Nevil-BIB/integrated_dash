# peak-backend VPS Deployment Guide

Production-ready Node.js + TypeScript + Express backend prepared for PM2 hosting on a VPS.

## Project Structure

```txt
peak-backend/
  src/
    controllers/
    routes/
    services/
    integrations/
    middlewares/
    utils/
    config/
    types/
    app.ts
    server.ts
  dist/                      # generated after build
  ecosystem.config.cjs       # PM2 config
  package.json
  tsconfig.json
  .env                       # create on VPS
  .env.example
```

## Environment Variables

Create a `.env` file in the project root:

```env
NODE_ENV=production
PORT=7001
SKYVERN_API_URL=https://api.skyvern.com/api/v1
SKYVERN_API_KEY=your_real_api_key
```

## NPM Scripts

- `npm run dev` - local development with nodemon
- `npm run build` - compile TypeScript into `dist/`
- `npm start` - run compiled app
- `npm run start:pm2` - start app with PM2
- `npm run restart:pm2` - restart PM2 app
- `npm run stop:pm2` - stop PM2 app
- `npm run logs:pm2` - stream PM2 logs

## VPS Deploy (WinSCP + SSH)

### 1) Upload code with WinSCP
- Upload `peak-backend` folder to your VPS path, for example:
  - `/var/www/peak-backend`

### 2) SSH into VPS and install runtime tools

```bash
sudo apt update
sudo apt install -y nodejs npm
sudo npm install -g pm2
```

### 3) Install dependencies and build

```bash
cd /var/www/peak-backend
npm install
npm run build
```

### 4) Create `.env`
- Add required env variables as shown above.

### 5) Start with PM2

```bash
npm run start:pm2
pm2 save
pm2 startup
```

### 6) Verify

```bash
pm2 status
pm2 logs peak-backend
curl http://localhost:7001/health
```

## Notes

- Keep `.env` out of source control.
- This backend currently uses placeholder integration logic for Skyvern service methods.
- Replace placeholders in `src/integrations/skyvern.integration.ts` when implementing real automation flows.
