#!/bin/bash

# Script para empacotar o código-fonte para a pasta de instalação
# Este script copia o código essencial ignorando node_modules e pastas de build

TARGET_DIR="./source"
mkdir -p $TARGET_DIR

echo "📦 Limpando destino..."
rm -rf $TARGET_DIR/*

echo "🚚 Copiando arquivos base..."
cp ../package.json ../package-lock.json ../turbo.json ../tsconfig.json $TARGET_DIR/

echo "📂 Copiando aplicações e pacotes (sem node_modules, logs ou backups)..."
# Copia apps e packages usando rsync ignorando arquivos desnecessários para nova instalação
rsync -av --progress ../apps $TARGET_DIR/ \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.next' \
    --exclude '.turbo' \
    --exclude 'logs' \
    --exclude 'backups' \
    --exclude 'cron_logs' \
    --exclude 'public/agents/*.exe'

rsync -av --progress ../packages $TARGET_DIR/ \
    --exclude 'node_modules' \
    --exclude 'dist'

echo "🔧 Copiando scripts de inicialização..."
cp ../start_irongrid.sh $TARGET_DIR/

echo "✅ Empacotamento concluído em linux-install/source"
echo "Agora você pode levar a pasta 'linux-install' inteira para o servidor de destino."
