.PHONY: help setup up down restart logs logs-backend logs-db logs-nginx ps status test dev-backend clean check-docker

# Detect OS
ifeq ($(OS),Windows_NT)
	DOCKER_COMPOSE ?= docker compose
else
	DOCKER_COMPOSE ?= docker compose
endif

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Nepali Word Game - Available Commands:"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  setup         Copy .env.example to .env and install backend dependencies"
	@echo "  up            Build and start all Docker services (Nginx, MySQL, Backend) in background"
	@echo "  down          Stop and remove all Docker containers"
	@echo "  restart       Restart all Docker services"
	@echo "  logs          View logs for all services"
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
	@echo "Setup complete! Run 'make up' to start the application."

up: check-docker ## Start application with Docker Compose
	@if [ ! -f .env ]; then \
		echo ".env not found! Running setup first..."; \
		make setup; \
	fi
	@echo "Starting services (Docker will automatically download Nginx, MySQL, and Node if missing)..."
	$(DOCKER_COMPOSE) up -d --build

down: check-docker ## Stop application containers
	$(DOCKER_COMPOSE) down

restart: check-docker ## Restart application containers
	$(DOCKER_COMPOSE) down
	$(DOCKER_COMPOSE) up -d --build

logs: check-docker ## View all service logs
	$(DOCKER_COMPOSE) logs -f

logs-backend: check-docker ## View backend service logs
	$(DOCKER_COMPOSE) logs -f backend

logs-db: check-docker ## View database service logs
	$(DOCKER_COMPOSE) logs -f mysql

logs-nginx: check-docker ## View nginx service logs
	$(DOCKER_COMPOSE) logs -f nginx

ps: check-docker ## View status of running containers
	$(DOCKER_COMPOSE) ps

status: ps

test: ## Run backend tests
	@cd backend && (command -v pnpm >/dev/null 2>&1 && pnpm test || npm test)

dev-backend: ## Run backend locally in dev mode
	@if [ ! -f backend/.env ]; then \
		cp .env.example backend/.env 2>/dev/null || cp .env backend/.env 2>/dev/null || true; \
	fi
	@cd backend && (command -v pnpm >/dev/null 2>&1 && pnpm dev || npm run dev)

clean: ## Remove containers, volumes, and node_modules
	-$(DOCKER_COMPOSE) down -v --remove-orphans 2>/dev/null
	rm -rf backend/node_modules
	@echo "Clean completed."
