# DNA Platform Makefile

.PHONY: help
help:
	@echo "DNA Platform - Available targets:"
	@echo "  help          - Show this help message"
	@echo ""
	@echo "Local Development:"
	@echo "  up            - Start local stack (docker-compose)"
	@echo "  down          - Stop local stack"
	@echo "  logs          - Follow logs from all services"
	@echo "  seed          - Bootstrap Kafka topics and ES index"
	@echo "  rebuild       - Rebuild and restart services"
	@echo "  clean         - Remove all volumes and containers"
	@echo ""
	@echo "Testing:"
	@echo "  test          - Run all tests (Node.js, Go, Python)"
	@echo "  test-node     - Run Node.js tests (Jest)"
	@echo "  test-go       - Run Go tests"
	@echo "  test-python   - Run Python tests (pytest)"
	@echo "  test-ci       - Run tests like CI pipeline"

# ============================================
# Local Development
# ============================================

COMPOSE_FILE := deploy/compose/docker-compose.local.yml

.PHONY: up
up:
	@echo "Starting DNA platform local stack..."
	docker compose -f $(COMPOSE_FILE) up -d
	@echo "Waiting for services to be healthy..."
	@sleep 10
	@echo "Local stack is up. Run 'make seed' to bootstrap topics and indices."

.PHONY: down
down:
	@echo "Stopping DNA platform local stack..."
	docker compose -f $(COMPOSE_FILE) down

.PHONY: logs
logs:
	docker compose -f $(COMPOSE_FILE) logs -f

.PHONY: seed
seed:
	@echo "Bootstrapping Kafka topics and Elasticsearch index..."
	bash scripts/bootstrap-local.sh
	@echo "Bootstrap complete!"

.PHONY: rebuild
rebuild:
	@echo "Rebuilding services..."
	docker compose -f $(COMPOSE_FILE) build --no-cache ingestion processing decision
	docker compose -f $(COMPOSE_FILE) up -d --force-recreate ingestion processing decision
	@echo "Services rebuilt and restarted."

.PHONY: clean
clean:
	@echo "Cleaning up all containers and volumes..."
	docker compose -f $(COMPOSE_FILE) down -v
	@echo "Clean complete!"

# ============================================
# Testing
# ============================================

.PHONY: test
test: test-node test-go test-python
	@echo "All tests completed!"

.PHONY: test-node
test-node:
	@echo "Running Node.js tests (Jest)..."
	@echo "Testing config service..."
	@cd services/config && npm test -- --passWithNoTests
	@echo "Testing categorization service..."
	@cd services/categorization && npm test -- --testPathPattern=smoke --passWithNoTests
	@echo "Testing decision service..."
	@cd services/decision && npm test -- --testPathPattern=smoke --passWithNoTests
	@echo "Node.js tests completed!"

.PHONY: test-go
test-go:
	@echo "Running Go tests..."
	@echo "Testing ingestion service..."
	@cd services/ingestion && go test ./pkg/ingestion/... -v
	@echo "Testing processing service..."
	@cd services/processing && go test ./pkg/processing/... -v
	@echo "Testing correlation service..."
	@cd services/correlation && go test ./pkg/correlation/... -v
	@echo "Go tests completed!"

.PHONY: test-python
test-python:
	@echo "Running Python tests (pytest)..."
	@cd services/model && python -m pytest tests/test_smoke.py -v
	@echo "Python tests completed!"

.PHONY: test-ci
test-ci:
	@echo "Running tests like CI pipeline..."
	@echo "=== Node.js Tests ==="
	@$(MAKE) test-node
	@echo "=== Go Tests ==="
	@$(MAKE) test-go
	@echo "=== Python Tests ==="
	@$(MAKE) test-python
	@echo "=== All Tests Completed ==="
