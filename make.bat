@echo off
setlocal enabledelayedexpansion

:: Check if GNU make command exists in PATH
where make >nul 2>nul
if %errorlevel% equ 0 (
    if "%~1"=="" (
        make
    ) else (
        make %*
    )
    exit /b %errorlevel%
)

:: Fallback implementation for Windows native CMD/PowerShell if GNU make is not installed
set TARGET=%1
if "%TARGET%"==" " set TARGET=help
if "%TARGET%"=="" set TARGET=help

if /i "%TARGET%"=="help" goto help
if /i "%TARGET%"=="setup" goto setup
if /i "%TARGET%"=="up" goto up
if /i "%TARGET%"=="nginx" goto nginx
if /i "%TARGET%"=="down" goto down
if /i "%TARGET%"=="restart" goto restart
if /i "%TARGET%"=="restart-nginx" goto restart-nginx
if /i "%TARGET%"=="logs" goto logs
if /i "%TARGET%"=="logs-backend" goto logs-backend
if /i "%TARGET%"=="logs-db" goto logs-db
if /i "%TARGET%"=="logs-nginx" goto logs-nginx
if /i "%TARGET%"=="ps" goto ps
if /i "%TARGET%"=="status" goto ps
if /i "%TARGET%"=="test" goto test
if /i "%TARGET%"=="dev-backend" goto dev-backend
if /i "%TARGET%"=="clean" goto clean

echo Unknown target: %TARGET%
echo Run 'make' or 'make help' to see available targets.
exit /b 1

:help
echo Akshara - Available Commands:
echo.
echo Usage: make [target]  or  .\make.bat [target]
echo.
echo Targets:
echo   setup         Copy .env.example to .env and install backend dependencies
echo   up            Build and start standard Docker services (MySQL, Backend, Frontend) WITHOUT Nginx
echo   nginx         Build and start Docker services WITH Nginx reverse proxy
echo   down          Stop and remove all Docker containers
echo   restart       Restart standard Docker services (without Nginx)
echo   restart-nginx Restart Docker services WITH Nginx reverse proxy
echo   logs          View logs for running services
echo   logs-backend  View backend logs
echo   logs-db       View database logs
echo   logs-nginx    View nginx logs
echo   ps            Show status of running containers
echo   test          Run backend unit tests
echo   dev-backend   Run backend locally in development mode
echo   clean         Stop containers, remove volumes and node_modules
goto :eof

:check_docker
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH!
    echo Please install Docker Desktop for Windows: https://www.docker.com/products/docker-desktop/
    exit /b 1
)
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker Desktop is installed but not currently running!
    echo Please start Docker Desktop on your machine and try again.
    exit /b 1
)
goto :eof

:setup
if not exist .env (
    echo Creating .env from .env.example...
    copy .env.example .env
) else (
    echo .env file already exists.
)
echo Installing backend dependencies...
cd backend
where pnpm >nul 2>nul
if %errorlevel% equ 0 (
    call pnpm install
) else (
    call npm install
)
cd ..
echo Setup complete! Run 'make up' (without Nginx) or 'make nginx' (with Nginx) to start the application.
goto :eof

:up
call :check_docker
if %errorlevel% neq 0 exit /b %errorlevel%

if not exist .env (
    echo .env not found! Running setup first...
    call :setup
)
echo Starting standard services (MySQL, Backend, Frontend) WITHOUT Nginx...
docker compose up -d --build
goto :eof

:nginx
call :check_docker
if %errorlevel% neq 0 exit /b %errorlevel%

if not exist .env (
    echo .env not found! Running setup first...
    call :setup
)
echo Starting services WITH Nginx reverse proxy...
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d --build
goto :eof

:down
call :check_docker
if %errorlevel% neq 0 exit /b %errorlevel%
docker compose -f docker-compose.yml -f docker-compose.nginx.yml down --remove-orphans
goto :eof

:restart
call :check_docker
if %errorlevel% neq 0 exit /b %errorlevel%
docker compose down --remove-orphans
docker compose up -d --build
goto :eof

:restart-nginx
call :check_docker
if %errorlevel% neq 0 exit /b %errorlevel%
docker compose -f docker-compose.yml -f docker-compose.nginx.yml down --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d --build
goto :eof

:logs
call :check_docker
if %errorlevel% neq 0 exit /b %errorlevel%
docker compose -f docker-compose.yml -f docker-compose.nginx.yml logs -f
goto :eof

:logs-backend
call :check_docker
if %errorlevel% neq 0 exit /b %errorlevel%
docker compose logs -f backend
goto :eof

:logs-db
call :check_docker
if %errorlevel% neq 0 exit /b %errorlevel%
docker compose logs -f mysql
goto :eof

:logs-nginx
call :check_docker
if %errorlevel% neq 0 exit /b %errorlevel%
docker compose -f docker-compose.yml -f docker-compose.nginx.yml logs -f nginx
goto :eof

:ps
call :check_docker
if %errorlevel% neq 0 exit /b %errorlevel%
docker compose -f docker-compose.yml -f docker-compose.nginx.yml ps
goto :eof

:test
cd backend
where pnpm >nul 2>nul
if %errorlevel% equ 0 (
    call pnpm test
) else (
    call npm test
)
cd ..
goto :eof

:dev-backend
cd backend
where pnpm >nul 2>nul
if %errorlevel% equ 0 (
    call pnpm dev
) else (
    call npm run dev
)
cd ..
goto :eof

:clean
call :check_docker
docker compose -f docker-compose.yml -f docker-compose.nginx.yml down -v --remove-orphans 2>nul
if exist backend\node_modules rmdir /s /q backend\node_modules
echo Clean completed.
goto :eof
