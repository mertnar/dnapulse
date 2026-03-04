.PHONY: build clean install test

BINARY_NAME=dnapulse-agent
VERSION=1.0.0
BUILD_DIR=build
INSTALL_DIR=/usr/local/bin
CONFIG_DIR=/etc/dnapulse-agent
LOG_DIR=/var/log/dnapulse-agent

build:
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(BINARY_NAME) -ldflags "-X main.version=$(VERSION)" cmd/agent/main.go

build-linux:
	@echo "Building $(BINARY_NAME) for Linux..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 cmd/agent/main.go

build-windows:
	@echo "Building $(BINARY_NAME) for Windows..."
	@mkdir -p $(BUILD_DIR)
	GOOS=windows GOARCH=amd64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe cmd/agent/main.go

build-macos:
	@echo "Building $(BINARY_NAME) for macOS..."
	@mkdir -p $(BUILD_DIR)
	GOOS=darwin GOARCH=amd64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 cmd/agent/main.go
	GOOS=darwin GOARCH=arm64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-arm64 cmd/agent/main.go

build-linux-resource-monitor: ## Build linux-resource-monitor agent
	@echo "Building linux-resource-monitor agent..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 go build -o $(BUILD_DIR)/linux-resource-monitor-linux-amd64 -ldflags "-X main.version=$(VERSION)" cmd/agent/main.go
	GOOS=linux GOARCH=arm64 go build -o $(BUILD_DIR)/linux-resource-monitor-linux-arm64 -ldflags "-X main.version=$(VERSION)" cmd/agent/main.go
	@echo "✓ linux-resource-monitor agent built"

build-syslog: ## Build syslog agent
	@echo "Building syslog agent..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 go build -o $(BUILD_DIR)/syslog-linux-amd64 -ldflags "-X main.version=$(VERSION)" cmd/agent/main.go
	GOOS=linux GOARCH=arm64 go build -o $(BUILD_DIR)/syslog-linux-arm64 -ldflags "-X main.version=$(VERSION)" cmd/agent/main.go
	@echo "✓ syslog agent built"

build-all: build-linux build-windows build-macos build-linux-resource-monitor build-syslog

test:
	@echo "Testing..."
	go test -v ./...

clean:
	@echo "Cleaning..."
	rm -rf $(BUILD_DIR)

install: build
	@echo "Installing $(BINARY_NAME)..."
	sudo mkdir -p $(INSTALL_DIR)
	sudo mkdir -p $(CONFIG_DIR)
	sudo mkdir -p $(LOG_DIR)
	sudo cp $(BUILD_DIR)/$(BINARY_NAME) $(INSTALL_DIR)/
	sudo chmod +x $(INSTALL_DIR)/$(BINARY_NAME)
	@if [ ! -f $(CONFIG_DIR)/agent.yaml ]; then \
		sudo cp configs/agent.example.yaml $(CONFIG_DIR)/agent.yaml; \
		echo "Config file installed to $(CONFIG_DIR)/agent.yaml"; \
		echo "Please edit this file with your API key and settings"; \
	fi
	@echo "Installation complete!"
	@echo "Edit config: sudo nano $(CONFIG_DIR)/agent.yaml"
	@echo "Run agent: $(INSTALL_DIR)/$(BINARY_NAME) -config $(CONFIG_DIR)/agent.yaml"

uninstall:
	@echo "Uninstalling $(BINARY_NAME)..."
	sudo rm -f $(INSTALL_DIR)/$(BINARY_NAME)
	@echo "Uninstallation complete!"
	@echo "Config files remain in $(CONFIG_DIR)"
