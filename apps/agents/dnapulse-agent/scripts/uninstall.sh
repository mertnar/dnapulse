#!/bin/bash
set -e

# DNA Pulse Agent Uninstallation Script

BINARY_NAME="dnapulse-agent"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/dnapulse-agent"
LOG_DIR="/var/log/dnapulse-agent"
SERVICE_FILE="/etc/systemd/system/dnapulse-agent.service"
USER="dnapulse"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo -e "${RED}Error: Please run as root (use sudo)${NC}"
   exit 1
fi

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}DNA Pulse Agent Uninstallation${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Stop and disable service
if systemctl is-active --quiet dnapulse-agent; then
    echo -e "${BLUE}Stopping service...${NC}"
    systemctl stop dnapulse-agent
    echo -e "${GREEN}✓${NC} Service stopped"
fi

if systemctl is-enabled --quiet dnapulse-agent 2>/dev/null; then
    echo -e "${BLUE}Disabling service...${NC}"
    systemctl disable dnapulse-agent
    echo -e "${GREEN}✓${NC} Service disabled"
fi

# Remove service file
if [ -f "$SERVICE_FILE" ]; then
    echo -e "${BLUE}Removing service file...${NC}"
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload
    echo -e "${GREEN}✓${NC} Service file removed"
fi

# Remove binary
if [ -f "$INSTALL_DIR/$BINARY_NAME" ]; then
    echo -e "${BLUE}Removing binary...${NC}"
    rm -f "$INSTALL_DIR/$BINARY_NAME"
    echo -e "${GREEN}✓${NC} Binary removed"
fi

# Ask about config and logs
echo ""
read -p "Remove configuration files? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "$CONFIG_DIR" ]; then
        rm -rf "$CONFIG_DIR"
        echo -e "${GREEN}✓${NC} Configuration removed"
    fi
fi

read -p "Remove log files? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "$LOG_DIR" ]; then
        rm -rf "$LOG_DIR"
        echo -e "${GREEN}✓${NC} Logs removed"
    fi
fi

read -p "Remove user '$USER'? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if id -u $USER > /dev/null 2>&1; then
        userdel $USER
        echo -e "${GREEN}✓${NC} User removed"
    fi
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Uninstallation Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
