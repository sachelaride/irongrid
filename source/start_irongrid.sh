#!/bin/bash

# IronGrid - Full Startup Script (Services + Apps)
echo "----------------------------------------------------"
echo "🚀 Iniciando IronGrid - Sistema de Monitoramento"
echo "----------------------------------------------------"

# 1. Verificar e Iniciar Serviços de Fundo
echo "🔧 Verificando serviços de dependência..."

# PostgreSQL
if ! systemctl is-active --quiet postgresql; then
    echo "🐘 Iniciando PostgreSQL..."
    sudo systemctl start postgresql
fi

# InfluxDB
if ! systemctl is-active --quiet influxdb; then
    echo "📈 Iniciando InfluxDB..."
    sudo systemctl start influxdb
fi

echo "✅ Serviços de fundo verificados."

# 2. Verificar dependências Node.js
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências npm..."
    npm install
fi

# 3. Verificar limites do sistema (inotify)
WATCHES=$(cat /proc/sys/fs/inotify/max_user_watches)
INSTANCES=$(cat /proc/sys/fs/inotify/max_user_instances)

if [ "$WATCHES" -lt 524288 ] || [ "$INSTANCES" -lt 512 ]; then
    echo "⚠️  AVISO: Limites de inotify baixos detectados ($WATCHES watches, $INSTANCES instâncias)."
    echo "Isso pode causar erros 'EMFILE' em ambientes com múltiplos serviços Vite/Turbo."
    echo "Recomenda-se aumentar temporariamente com:"
    echo "   sudo sysctl -w fs.inotify.max_user_watches=524288"
    echo "   sudo sysctl -w fs.inotify.max_user_instances=512"
    echo "----------------------------------------------------"
fi

# 3. Iniciar Aplicações (Dashboard, Servidor, Agente Local)
echo "🖥️  Iniciando Workspaces em paralelo..."
echo "ℹ️  O Frontend (Vite) rodará na porta 3001 e repassará a API para o Backend na porta 3002."
npx turbo dev --parallel --no-daemon
