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
