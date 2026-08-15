set dotenv-load := true

alias c := check

default:
    @just --list

# Validate all code (parallel checks)
check:
    bunx tempo check

# Format source files
format:
    bunx tempo fmt

# Lint with ESLint
lint:
    bunx tempo lint

# Start Vite dev server
dev:
    bunx tempo dev

# Build for production
build:
    bunx tempo build

# Deploy to Cloudflare Workers
deploy:
    bunx tempo deploy

# Upload ONNX models, WASM files, and demo images to R2
upload *args:
    bunx tempo upload -- {{args}}

# Download demo images from Pexels and generate manifest
download *args:
    bunx tempo download -- {{args}}
