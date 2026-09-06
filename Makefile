.PHONY: help setup up nginx down restart restart-nginx logs logs-backend logs-db logs-nginx ps status test dev-backend clean check-docker

DOCKER_COMPOSE := docker compose

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Akshara - Available Commands:"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  setup         Copy .env.example to .env and install backend dependencies"
	@echo "  up            Build and start standard Docker services (MySQL, Backend, Frontend) WITHOUT Nginx"
	@echo "  nginx         Build and start Docker services WITH Nginx reverse proxy"
	@echo "  down          Stop and remove all Docker containers"
	@echo "  restart       Restart standard Docker services (without Nginx)"
	@echo "  restart-nginx Restart Docker services WITH Nginx reverse proxy"
	@echo "  logs          View logs for all running services"
	@echo "  logs-backend  View backend logs"
	@echo "  logs-db       View database logs"
	@echo "  logs-nginx    View nginx logs"
	@echo "  ps            Show status of running containers"
	@echo "  test          Run backend unit tests"
	@echo "  dev-backend   Run backend locally in development mode"
	@echo "  clean         Stop containers, remove volumes and node_modules"
	@echo ""

check-docker:
	@command -v docker >/dev/null 2>&1 || (echo "[ERROR] Docker is not installed or not in PATH! Download Docker Desktop: https://www.docker.com/products/docker-desktop/" && exit 1)
	@docker info >/dev/null 2>&1 || (echo "[ERROR] Docker daemon is not running! Please start Docker Desktop/Daemon." && exit 1)

setup: ## Setup environment and install dependencies
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
	else \
		echo ".env file already exists."; \
	fi
	@echo "Installing backend dependencies..."
	@cd backend && (command -v pnpm >/dev/null 2>&1 && pnpm install || npm install)
	@echo "Setup complete! Run 'make up' (without Nginx) or 'make nginx' (with Nginx) to start the application."

up: check-docker ## Start standard application WITHOUT Nginx
	@if [ ! -f .env ]; then \
		echo ".env not found! Running setup first..."; \
		make setup; \
	fi
	@echo "Starting standard services (MySQL, Backend, Frontend) WITHOUT Nginx..."
	$(DOCKER_COMPOSE) up -d --build

nginx: check-docker ## Start application WITH Nginx reverse proxy
	@if [ ! -f .env ]; then \
		echo ".env not found! Running setup first..."; \
		make setup; \
	fi
	@echo "Starting services WITH Nginx reverse proxy..."
	$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.nginx.yml up -d --build

down: check-docker ## Stop application containers
	$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.nginx.yml down --remove-orphans

restart: check-docker ## Restart standard application (without Nginx)
	$(DOCKER_COMPOSE) down --remove-orphans
	$(DOCKER_COMPOSE) up -d --build

restart-nginx: check-docker ## Restart application WITH Nginx reverse proxy
	$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.nginx.yml down --remove-orphans
	$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.nginx.yml up -d --build

logs: check-docker ## View service logs
	$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.nginx.yml logs -f

logs-backend: check-docker ## View backend service logs
	$(DOCKER_COMPOSE) logs -f backend

logs-db: check-docker ## View database service logs
	$(DOCKER_COMPOSE) logs -f mysql

logs-nginx: check-docker ## View nginx service logs
	$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.nginx.yml logs -f nginx

ps: check-docker ## View status of running containers
	$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.nginx.yml ps

status: ps

test: ## Run backend tests
	@cd backend && (command -v pnpm >/dev/null 2>&1 && pnpm test || npm test)

dev-backend: ## Run backend locally in dev mode
	@if [ ! -f backend/.env ]; then \
		cp .env.example backend/.env 2>/dev/null || cp .env backend/.env 2>/dev/null || true; \
	fi
	@cd backend && (command -v pnpm >/dev/null 2>&1 && pnpm dev || npm run dev)

clean: ## Remove containers, volumes, and node_modules
	-$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.nginx.yml down -v --remove-orphans 2>/dev/null
	rm -rf backend/node_modules
	@echo "Clean completed."
