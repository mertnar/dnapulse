#!/bin/bash

# Categorization Service Local Startup Script
# Bu script servisi yerel ortamda başlatır

set -e

echo "🚀 Categorization Servisini Başlatıyoruz..."

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Config dizini
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 1. Bağımlılıkları kontrol et
echo -e "${YELLOW}📦 Bağımlılıklar kontrol ediliyor...${NC}"
if [ ! -d "node_modules" ]; then
    echo "Node modules bulunamadı, yükleniyor..."
    npm install
else
    echo -e "${GREEN}✅ Node modules mevcut${NC}"
fi

# 2. MongoDB kontrolü
echo -e "${YELLOW}🔍 MongoDB kontrol ediliyor...${NC}"
if ! mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${RED}❌ MongoDB çalışmıyor!${NC}"
    echo "MongoDB'yi başlatmak için:"
    echo "  sudo systemctl start mongodb"
    echo "  VEYA"
    echo "  docker run -d -p 27017:27017 --name mongodb mongo:latest"
    exit 1
else
    echo -e "${GREEN}✅ MongoDB çalışıyor${NC}"
fi

# 3. Config Service kontrolü
echo -e "${YELLOW}🔍 Config Service kontrol ediliyor...${NC}"
CONFIG_URL=${CONFIG_URL:-http://localhost:8084}
if ! curl -s -f "$CONFIG_URL/health" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Config Service çalışmıyor!${NC}"
    echo "Config Service'i başlatmak için:"
    echo "  cd ../config && npm run dev"
    echo ""
    echo -e "${YELLOW}Config Service olmadan da başlatılabilir, ancak config yüklenemez.${NC}"
    read -p "Devam etmek istiyor musunuz? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ Config Service çalışıyor${NC}"
fi

# 4. Environment variables ayarla
echo -e "${YELLOW}⚙️  Environment variables ayarlanıyor...${NC}"
export PORT=${PORT:-8083}
export HOST=${HOST:-0.0.0.0}
export LOG_LEVEL=${LOG_LEVEL:-info}
export CONFIG_URL=${CONFIG_URL:-http://localhost:8084}
export CONFIG_SCOPE=${CONFIG_SCOPE:-categorization}
export MONGO_URI=${MONGO_URI:-mongodb://localhost:27017}
export MONGO_DATABASE=${MONGO_DATABASE:-categorization}
export BYPASS_AUTH=${BYPASS_AUTH:-true}

echo "  PORT: $PORT"
echo "  CONFIG_URL: $CONFIG_URL"
echo "  MONGO_URI: $MONGO_URI"

# 5. Config'i yükle (opsiyonel)
if [ -f "dev.categorization.json" ]; then
    echo -e "${YELLOW}📝 Config yükleniyor...${NC}"
    if curl -s -f "$CONFIG_URL/health" > /dev/null 2>&1; then
        if curl -X POST "$CONFIG_URL/v1/config/categorization" \
            -H 'Content-Type: application/json' \
            -d @dev.categorization.json > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Config yüklendi${NC}"
        else
            echo -e "${YELLOW}⚠️  Config yüklenemedi (zaten mevcut olabilir)${NC}"
        fi
    fi
fi

# 6. Build (production için)
if [ "$NODE_ENV" = "production" ]; then
    echo -e "${YELLOW}🔨 Building...${NC}"
    npm run build
    echo -e "${GREEN}✅ Build tamamlandı${NC}"
fi

# 7. Servisi başlat
echo ""
echo -e "${GREEN}✨ Categorization Servisi başlatılıyor...${NC}"
echo ""
echo "📍 Service URL: http://localhost:$PORT"
echo "🏥 Health Check: http://localhost:$PORT/health"
echo "📊 Metrics: http://localhost:$PORT/metrics"
echo ""
echo "Durdurmak için: Ctrl+C"
echo ""

# Development veya production mode
if [ "$NODE_ENV" = "production" ]; then
    npm start
else
    npm run dev
fi
