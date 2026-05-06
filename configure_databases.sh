#!/bin/bash

# Script de Configuração Inicial de Bancos de Dados - IronGrid

DB_NAME="irongrid"
DB_USER="irongrid_user"
read -p "Defina a senha para o usuário PostgreSQL ($DB_USER): " DB_PASS

echo "🐘 Configurando PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Banco de dados já existe."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "Usuário já existe."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo "📈 Configurando InfluxDB 2..."
echo "Acesse http://localhost:8086 no navegador para realizar o setup inicial do InfluxDB."
echo "Após o setup, guarde o TOKEN, ORGANIZAÇÃO e BUCKET para configurar o arquivo .env."

echo "----------------------------------------------------"
echo "✅ Configuração de bancos finalizada."
echo "Agora, atualize o arquivo apps/server/.env com os seguintes dados:"
echo "DATABASE_URL=\"postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public\""
echo "----------------------------------------------------"
