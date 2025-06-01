# Makefile for LLM Research Chat
# Supports both Electron and Svelte/PWA versions

.PHONY: all clean install install-svelte build build-electron build-svelte run run-electron run-svelte serve-pwa dev dev-svelte test lint

# Default target
all: install build

# Clean build artifacts
clean:
	rm -rf build dist node_modules svelte-app/node_modules svelte-app/dist

# Install dependencies for Electron app
install:
	npm install

# Install dependencies for Svelte app
install-svelte:
	cd svelte-app && npm install

# Build targets
build: build-electron

build-electron:
	npm run build

build-svelte:
	cd svelte-app && npm run build

# Run targets
run: run-electron

run-electron:
	npm start

run-svelte:
	cd svelte-app && npm run dev

# Serve PWA in production mode
serve-pwa:
	cd svelte-app && npm run preview

# Development targets
dev: run-electron

dev-svelte: run-svelte

# Testing
test:
	npm test

# Linting
lint:
	npm run lint

# Setup Svelte project
setup-svelte:
	mkdir -p svelte-app
	cd svelte-app && npm create vite@latest . -- --template svelte
	cd svelte-app && npm install -D @sveltejs/adapter-static vite-plugin-pwa workbox-window

# Build and run Svelte in production mode
prod-svelte: build-svelte serve-pwa

# Full setup and run for Svelte
full-svelte: setup-svelte install-svelte dev-svelte

# Help target
help:
	@echo "Available targets:"
	@echo "  make install          - Install Electron app dependencies"
	@echo "  make build            - Build Electron app"
	@echo "  make run              - Run Electron app"
	@echo "  make setup-svelte     - Create Svelte project structure"
	@echo "  make install-svelte   - Install Svelte app dependencies"
	@echo "  make build-svelte     - Build Svelte app"
	@echo "  make run-svelte       - Run Svelte app in dev mode"
	@echo "  make serve-pwa        - Serve PWA in production mode"
	@echo "  make full-svelte      - Full setup and run Svelte app"
	@echo "  make clean            - Clean all build artifacts"
	@echo "  make help             - Show this help message"