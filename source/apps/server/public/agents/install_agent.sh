#!/bin/bash

# IronGrid Linux Agent/SNMP Installer
# Usage: sudo bash install_agent.sh [SERVER_IP] [COMMUNITY]

# Perguntar IP se não for passado via argumento
if [ -z "$1" ]; then
    read -p "Digite o IP ou hostname do servidor IronGrid: " SERVER_IP
else
    SERVER_IP=$1
fi

# Perguntar Comunidade se não for passada via argumento
if [ -z "$2" ]; then
    read -p "Digite a comunidade SNMP [IronGrid]: " COMMUNITY
    COMMUNITY=${COMMUNITY:-"IronGrid"}
else
    COMMUNITY=$2
fi

echo "------------------------------------------------"
echo " IronGrid - Instalador de Agente Linux"
echo " Servidor: $SERVER_IP"
echo " Comunidade: $COMMUNITY"
echo "------------------------------------------------"

if [[ $EUID -ne 0 ]]; then
   echo "Este script precisa ser executado como ROOT (sudo)."
   exit 1
fi

# 1. SNMP Installation
echo "[1/3] Instalando SNMP Service (snmpd)..."
if command -v apt-get &> /dev/null; then
    apt-get update && apt-get install -y snmpd
elif command -v yum &> /dev/null; then
    yum install -y net-snmp
fi

# 2. SNMP Configuration
echo "[2/3] Configurando SNMP..."
CONF_FILE="/etc/snmp/snmpd.conf"
if [ -f "$CONF_FILE" ]; then
    mv $CONF_FILE ${CONF_FILE}.bak
fi

cat <<EOF > $CONF_FILE
# IronGrid SNMP Configuration
agentAddress  udp:161
rocommunity $COMMUNITY $SERVER_IP
sysLocation    "Local"
sysContact     "Admin"
EOF

systemctl restart snmpd
systemctl enable snmpd
echo "OK: SNMP configurado e reiniciado."

# 3. Agent installation placeholder 
echo "[3/3] Instalando Agente Node.js (opcional)..."
echo "Aviso: Para rodar o agente completo no Linux, certifique-se de ter o Node.js instalado."
echo "Configurando arquivo de conexao..."

mkdir -p /opt/irongrid-agent
cat <<EOF > /opt/irongrid-agent/config.json
{
    "serverUrl": "http://$SERVER_IP:3001",
    "agentId": "$(hostname)"
}
EOF

echo "OK: Configuracao do agente salva em /opt/irongrid-agent/config.json"
echo "------------------------------------------------"
echo " Instalacao Concluida!"
echo "------------------------------------------------"
