#!/bin/bash
set -e

# DNA Pulse Agent Installation Script
# This script installs the DNA Pulse agent as a system service

VERSION="1.0.0"
BINARY_NAME="dnapulse-agent"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/dnapulse-agent"
LOG_DIR="/var/log/dnapulse-agent"
SERVICE_FILE="/etc/systemd/system/dnapulse-agent.service"
USER="dnapulse"
GROUP="dnapulse"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo -e "${RED}Error: Please run as root (use sudo)${NC}"
   exit 1
fi

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}DNA Pulse Agent Installation${NC}"
echo -e "${BLUE}Version: $VERSION${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION_ID=$VERSION_ID
else
    echo -e "${RED}Error: Unable to detect OS${NC}"
    exit 1
fi

echo -e "${BLUE}Detected OS:${NC} $OS $VERSION_ID"
echo ""

# Check if systemd is available
if ! command -v systemctl &> /dev/null; then
    echo -e "${RED}Error: systemd is required but not found${NC}"
    exit 1
fi

# Create user and group
echo -e "${BLUE}Creating user and group...${NC}"
if ! id -u $USER > /dev/null 2>&1; then
    useradd --system --no-create-home --shell /bin/false $USER
    echo -e "${GREEN}✓${NC} User '$USER' created"
else
    echo -e "${YELLOW}!${NC} User '$USER' already exists"
fi

# Create directories
echo -e "${BLUE}Creating directories...${NC}"
mkdir -p $INSTALL_DIR
mkdir -p $CONFIG_DIR
mkdir -p $LOG_DIR
mkdir -p $CONFIG_DIR/backups

# Set permissions
chown -R $USER:$GROUP $CONFIG_DIR
chown -R $USER:$GROUP $LOG_DIR
chmod 755 $CONFIG_DIR
chmod 755 $LOG_DIR

echo -e "${GREEN}✓${NC} Directories created"

# Copy binary
echo -e "${BLUE}Installing binary...${NC}"
if [ -f "../build/$BINARY_NAME" ]; then
    cp "../build/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
    chmod +x "$INSTALL_DIR/$BINARY_NAME"
    echo -e "${GREEN}✓${NC} Binary installed to $INSTALL_DIR/$BINARY_NAME"
else
    echo -e "${RED}Error: Binary not found. Please run 'make build' first${NC}"
    exit 1
fi

# Copy or update config
if [ ! -f "$CONFIG_DIR/agent.yaml" ]; then
    echo -e "${BLUE}Installing default configuration...${NC}"
    if [ -f "../configs/agent.example.yaml" ]; then
        cp "../configs/agent.example.yaml" "$CONFIG_DIR/agent.yaml"
        chown $USER:$GROUP "$CONFIG_DIR/agent.yaml"
        chmod 640 "$CONFIG_DIR/agent.yaml"
        echo -e "${GREEN}✓${NC} Config installed to $CONFIG_DIR/agent.yaml"
        echo -e "${YELLOW}⚠${NC}  Please edit the configuration file and add your API key"
    else
        echo -e "${RED}Error: Example config not found${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}!${NC} Config file already exists, skipping"
fi

# Install systemd service
echo -e "${BLUE}Installing systemd service...${NC}"
if [ -f "../install/dnapulse-agent.service" ]; then
    cp "../install/dnapulse-agent.service" "$SERVICE_FILE"
    chmod 644 "$SERVICE_FILE"
    systemctl daemon-reload
    echo -e "${GREEN}✓${NC} Service installed"
else
    echo -e "${RED}Error: Service file not found${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo -e "1. Edit the configuration file:"
echo -e "   ${YELLOW}sudo nano $CONFIG_DIR/agent.yaml${NC}"
echo ""
echo -e "2. Add your API key (get from web app):"
echo -e "   ${YELLOW}ingestion:${NC}"
echo -e "   ${YELLOW}  api_key: \"YOUR_API_KEY_HERE\"${NC}"
echo ""
echo -e "3. Register the agent:"
echo -e "   ${YELLOW}sudo $INSTALL_DIR/$BINARY_NAME -config $CONFIG_DIR/agent.yaml -register${NC}"
echo ""
echo -e "4. Enable and start the service:"
echo -e "   ${YELLOW}sudo systemctl enable dnapulse-agent${NC}"
echo -e "   ${YELLOW}sudo systemctl start dnapulse-agent${NC}"
echo ""
echo -e "5. Check service status:"
echo -e "   ${YELLOW}sudo systemctl status dnapulse-agent${NC}"
echo ""
echo -e "6. View logs:"
echo -e "   ${YELLOW}sudo journalctl -u dnapulse-agent -f${NC}"
echo ""
