# SNAM Baitong – Production

This repository contains the production-ready backend (Node.js/Express, MySQL, MQTT, Telegram) and frontend (React) for SNAM Baitong.

## Local Development (Safe)

- Use `backend/.env.local` and `frontend/.env.local` (see `*.example` files) and never commit real secrets.
- Backend runs on port `5000` in development; frontend uses Vite on `5173`.
- Set `DISABLE_MQTT=true` and `TELEGRAM_MOCK=true` to prevent real messages in local dev.
- Point frontend API to local backend: `VITE_API_BASE_URL=http://localhost:5000/api`.
- Use a local MySQL database or a sanitized dump; never point to production.

### Start locally

```bash
# Backend (auto-reload)
cd backend
npm install
npm run dev

# Frontend (auto-reload)
cd ../frontend
npm install
npm run dev
```

## Git Workflow

- Branching: create feature branches off `main` or use `dev` as integration branch.
- CI: run tests on PRs; only merge tested/approved changes.
- Deployment: CI/CD deploys `main` only. Keep `main` production-ready at all times.
- No direct edits on the VM; all changes go through Git + CI/CD.

## Production Safety Rules

- Never send real MQTT or Telegram messages from local dev.
- Never write to the production database from local dev.
- Keep `.env*` secrets out of Git (already ignored).
- Avoid enabling extra PM2 instances on production.

For detailed backend setup, see [backend/RUNBOOK.md](backend/RUNBOOK.md).