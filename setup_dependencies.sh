#!/bin/bash

# Script de Instalação Automática de Dependências - IronGrid
# SO Suportado: Ubuntu 20.04+, Debian 11+

set -e

echo "----------------------------------------------------"
echo "🛠️  Instalando Dependências do IronGrid"
echo "----------------------------------------------------"

# 1. Atualizar sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar pacotes básicos
sudo apt install -y git curl build-essential wget gnupg2 ca-certificates lsb-release

# 3. Instalar Node.js 20 LTS
if ! command -v node &> /dev/null; then
    echo "📦 Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✅ Node.js já instalado ($(node -v))"
fi

# 4. Instalar PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "🐘 Instalando PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
else
    echo "✅ PostgreSQL já instalado."
fi

# 5. Instalar InfluxDB 2.x
if ! command -v influx &> /dev/null; then
    echo "📈 Instalando InfluxDB 2.x..."
    wget -q https://repos.influxdata.com/influxdata-archive_all.pub
    cat influxdata-archive_all.pub | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/influxdata-archive_all.gpg > /dev/null
    echo "deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive_all.gpg] https://repos.influxdata.com/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/influxdata.list
    sudo apt update && sudo apt install -y influxdb2
    sudo systemctl enable influxdb
    sudo systemctl start influxdb
else
    echo "✅ InfluxDB já instalado."
fi

# 6. Instalar PM2 para gestão de processos
if ! command -v pm2 &> /dev/null; then
    echo "🚀 Instalando PM2..."
    sudo npm install -g pm2
else
    echo "✅ PM2 já instalado."
fi

echo "----------------------------------------------------"
echo "🎉 Dependências instaladas com sucesso!"
echo "Próximos passos:"
echo "1. Configure os bancos de dados."
echo "2. Edite os arquivos .env em apps/server e apps/web."
echo "3. Execute 'npm install' e 'npm run build'."
echo "----------------------------------------------------"
