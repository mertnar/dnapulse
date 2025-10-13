# CI/CD Pipeline Documentation

This document explains the GitHub Actions CI/CD pipeline for the DNA Platform.

## Overview

The DNA Platform uses GitHub Actions for continuous integration and deployment with two main workflows:

1. **CI Workflow** (`.github/workflows/ci.yml`) - Runs on every push and PR
2. **Release Workflow** (`.github/workflows/release.yml`) - Runs on version tags

## CI Workflow

### Triggers

- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop` branches

### Jobs

#### 1. Lint & Format

- Runs pre-commit hooks (golangci-lint, ruff, prettier, buf)
- Ensures code quality and consistency
- **Duration**: ~2-3 minutes

#### 2. Protobuf Lint

- Uses `buf` to lint protobuf definitions
- Checks for breaking changes against main branch
- **Duration**: ~1 minute

#### 3. Go Tests

- Runs unit tests for ingestion and processing services
- Executes `golangci-lint` for Go code quality
- Uses matrix strategy for parallel testing
- **Duration**: ~3-4 minutes

#### 4. Decision Service Build

- Installs Node.js dependencies
- Builds TypeScript to JavaScript
- Runs ESLint for TypeScript code quality
- **Duration**: ~2-3 minutes

#### 5. Integration Test

- Starts local Docker stack
- Tests end-to-end event flow
- Verifies ingestion → processing → decision → Elasticsearch
- **Duration**: ~5-6 minutes

#### 6. Security Scan

- Runs Trivy vulnerability scanner on filesystem
- Uploads results to GitHub Security tab
- **Duration**: ~2-3 minutes

**Total CI Duration**: ~15-20 minutes

## Release Workflow

### Triggers

- Push of version tags matching pattern `v*.*.*` (e.g., `v1.0.0`, `v2.1.3`)

### Jobs

#### 1. Build and Push Images

- Builds multi-architecture Docker images (linux/amd64, linux/arm64)
- Pushes to GitHub Container Registry (GHCR)
- Uses Docker Buildx for efficient builds
- Creates multiple tags:
  - `v1.0.0` (exact version)
  - `v1.0` (major.minor)
  - `v1` (major)
  - `latest` (for main branch)
- **Duration**: ~8-12 minutes

#### 2. Create GitHub Release

- Generates changelog from git commits
- Creates GitHub release with Docker image instructions
- **Duration**: ~1-2 minutes

#### 3. Security Scan Images

- Scans released Docker images for vulnerabilities
- Uploads results to GitHub Security tab
- **Duration**: ~3-5 minutes

**Total Release Duration**: ~12-20 minutes

## Required Secrets

### For CI Workflow

- **None required** - Uses `GITHUB_TOKEN` (automatically provided)

### For Release Workflow

- **GITHUB_TOKEN** - Automatically provided by GitHub
- **No additional secrets needed** for GHCR (GitHub Container Registry)

## How to Cut a Release

### 1. Prepare Release

```bash
# Ensure you're on main branch and up to date
git checkout main
git pull origin main

# Run tests locally (optional)
make test  # or go test ./...
```

### 2. Create and Push Tag

```bash
# Create annotated tag (recommended)
git tag -a v0.1.0 -m "Release v0.1.0"

# Push tag to trigger release workflow
git push origin v0.1.0

# Or push all tags
git push --tags
```

### 3. Monitor Release

- Go to GitHub Actions tab to watch the release workflow
- Check the "Releases" page for the new release
- Verify Docker images are available on GHCR

### 4. Verify Images

```bash
# Test pulling the new images
docker pull ghcr.io/your-org/dna-platform/ingestion:v0.1.0
docker pull ghcr.io/your-org/dna-platform/processing:v0.1.0
docker pull ghcr.io/your-org/dna-platform/decision:v0.1.0
```

## Docker Images

### Image Names

Images are published to GitHub Container Registry with the following naming:

- `ghcr.io/your-org/dna-platform/ingestion:v0.1.0`
- `ghcr.io/your-org/dna-platform/processing:v0.1.0`
- `ghcr.io/your-org/dna-platform/decision:v0.1.0`

### Using Images in Docker Compose

```yaml
services:
  ingestion:
    image: ghcr.io/your-org/dna-platform/ingestion:v0.1.0
    # ... rest of config
```

## Local Development

### Pre-commit Setup

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

### Running Tests Locally

```bash
# Go tests
cd services/processing
go test -v ./...

# TypeScript build
cd services/decision
npm run build

# Integration test
make up && make seed
curl -X POST http://localhost:8080/ingest \
  -H 'Content-Type: application/json' \
  -d '{"metric":"cpu_usage","value":95.5,"source":"test"}'
```

## Troubleshooting

### CI Failures

#### Pre-commit Hooks Fail

```bash
# Fix formatting
pre-commit run --all-files

# Or fix specific issues
golangci-lint run --fix
npm run format  # in services/decision
```

#### Protobuf Lint Fails

```bash
# Check protobuf files
buf lint

# Generate protobuf code
buf generate
```

#### Tests Fail

```bash
# Run tests locally
go test -v ./...

# Check for missing dependencies
go mod tidy
```

### Release Failures

#### Docker Build Fails

- Check Dockerfile syntax
- Verify all dependencies are available
- Check for large files that might timeout

#### GHCR Push Fails

- Verify `GITHUB_TOKEN` has `packages: write` permission
- Check if repository has GitHub Container Registry enabled

## Performance Optimization

### CI Speed

- Tests run in parallel using matrix strategy
- Go modules are cached between runs
- Node modules are cached
- Docker layers are cached using GitHub Actions cache

### Release Speed

- Multi-architecture builds use Docker Buildx
- Images are cached using GitHub Actions cache
- Only changed services are rebuilt (if using proper Docker layer caching)

## Security Features

- **Trivy vulnerability scanning** on both code and images
- **Dependency scanning** through GitHub Dependabot
- **Secret scanning** through GitHub Advanced Security
- **Code scanning** through CodeQL (can be enabled)

## Monitoring

### CI Metrics

- Build success rate
- Build duration trends
- Test coverage (can be added)
- Security vulnerability trends

### Release Metrics

- Release frequency
- Time to release
- Image size trends
- Security scan results

## Future Improvements

1. **Test Coverage Reports** - Add coverage collection and reporting
2. **Performance Benchmarks** - Add performance testing in CI
3. **Staging Environment** - Deploy to staging on develop branch
4. **Rollback Capability** - Add automated rollback for failed releases
5. **Multi-environment Support** - Support for dev/staging/prod environments
6. **Helm Charts** - Add Kubernetes deployment manifests
