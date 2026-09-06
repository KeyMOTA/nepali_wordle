# नेपाली शब्द खेल — Nepali Word Game

A Wordle-inspired daily word puzzle for Devanagari (Nepali) script.
Guess the hidden **3-akshara Nepali word** in 6 tries. Includes color-coded feedback, streak tracking, and a global leaderboard.

## Tech Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | Vanilla HTML / CSS / JavaScript |
| Backend   | Node.js + Express (Clean Architecture) |
| Database  | MySQL 8 |
| Proxy     | Nginx |
| Container | Docker + Docker Compose |
| Email     | Nodemailer (Resend / Gmail SMTP / OAuth2) |

## Quick Start

### Prerequisites
- Docker Engine 24+ & Docker Compose v2
- Node.js 20+ (for local development without Docker)

### Setup & Run
```bash
# 1. Initialize environment & install dependencies
make setup

# 2. Start services (MySQL, Backend, Frontend)
make up

# Or start with Nginx reverse proxy:
make nginx
```
Services will be available at:
- **Frontend / Game**: http://localhost:8888
- **Backend API**: http://localhost:3000

### Makefile Commands

| Command | Description |
|---|---|
| `make setup` | Initialize `.env` and install dependencies |
| `make up` | Launch services (MySQL, Backend, Frontend) |
| `make nginx` | Launch services with Nginx reverse proxy |
| `make down` | Stop containers |
| `make logs` | Follow live container logs |
| `make test` | Run backend test suite |
| `make clean` | Remove containers, volumes, and `node_modules` |

## Production Deployment

### VPS Deployment (Docker Compose)
```bash
git clone https://github.com/KeyMOTA/nepali_wordle.git
cd nepali_wordle
cp .env.example .env
# Edit .env with production credentials
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### GitHub Pages + Railway
1. **Database & API**: Deploy `backend/` to Railway and provision MySQL. Set `MYSQL_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `FRONTEND_URL`, and SMTP credentials in Railway variables.
2. **Frontend**: Update `frontend/config.js` with your backend URL and push to GitHub. The GitHub Actions workflow (`.github/workflows/deploy-frontend.yml`) automatically builds and publishes the frontend to GitHub Pages.

## Local Development (without Docker)

```bash
# 1. Set up MySQL database
mysql -u root -p < database/schema.sql
mysql -u root -p nepali_word_game < database/seed.sql

# 2. Configure & run backend
cd backend
cp ../.env.example .env
npm install
npm run dev

# 3. Serve frontend
npx serve ../frontend -p 8080
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Create account & send verification email |
| POST | /api/auth/login | Sign in & receive JWT |
| GET | /api/auth/me | Get current user profile |
| GET | /api/auth/verify?token=... | Verify email address |
| POST | /api/auth/resend-verification | Resend verification email |
| GET | /api/game/daily | Get daily challenge metadata |
| GET | /api/game/practice | Get practice mode word |
| POST | /api/game/guess | Submit guess & receive feedback |
| GET | /api/stats | Get personal stats & streak |
| GET | /api/leaderboard | Get top players |
| GET | /api/health | Service health check |

## Running Tests

```bash
cd backend
npm test
```

