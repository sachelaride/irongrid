# 🐧 Guia de Instalação IronGrid em Linux Limpo (Debian/Ubuntu)

Este guia detalha os passos para instalar o ecossistema completo do IronGrid em um servidor Linux recém-instalado.

---

## 1. Requisitos do Sistema
*   **SO:** Ubuntu 22.04 LTS ou Debian 12 (Recomendado).
*   **Hardware:** Mínimo 2 vCPU, 4GB RAM, 20GB SSD.
*   **Acesso:** Usuário com permissões de `sudo`.

---

## 2. Preparação do Ambiente (Dependências)

Execute os comandos abaixo para instalar as ferramentas básicas:

```bash
# Atualizar o sistema
sudo apt update && sudo apt upgrade -y

# Instalar ferramentas auxiliares
sudo apt install -y git curl build-essential wget gnupg2
```

### 2.1 Instalar Node.js (v20 LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2.2 Instalar PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Criar banco de dados e usuário
sudo -u postgres psql -c "CREATE DATABASE irongrid;"
sudo -u postgres psql -c "CREATE USER irongrid_user WITH PASSWORD 'sua_senha_aqui';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE irongrid TO irongrid_user;"
```

### 2.3 Instalar InfluxDB (v2.x)
```bash
wget -q https://repos.influxdata.com/influxdata-archive_all.pub
echo '23a1d88de878f7921b7479417311707a3c1e91af974064b72f76c9b77d5469d5 influxdata-archive_all.pub' | sha256sum -c && cat influxdata-archive_all.pub | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/influxdata-archive_all.gpg > /dev/null
echo 'deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive_all.gpg] https://repos.influxdata.com/debian stable main' | sudo tee /etc/apt/sources.list.d/influxdata.list

sudo apt update && sudo apt install influxdb2 -y
sudo systemctl enable influxdb
sudo systemctl start influxdb
```

---

## 3. Preparação do Código IronGrid

Como você está utilizando este pacote de instalação, o código já está incluído na pasta `source/`.

### 3.1 Mover o código para o diretório de destino
```bash
# Recomendado: mover para /opt/irongrid
sudo mv source /opt/irongrid
cd /opt/irongrid
```

### 3.2 Instalar Dependências do Projeto
```bash
npm install
```

### 3.3 Configurar Variáveis de Ambiente (.env)
Você deve criar os arquivos `.env` baseados nos exemplos:

**No Servidor (`apps/server/.env`):**
```ini
DATABASE_URL="postgresql://irongrid_user:sua_senha_aqui@localhost:5432/irongrid?schema=public"
INFLUX_URL="http://localhost:8086"
INFLUX_TOKEN="SEU_TOKEN_AQUI"
INFLUX_ORG="IronGrid"
INFLUX_BUCKET="monitoring"
JWT_SECRET="um_segredo_muito_forte"
DEV_PORT=3002
```

---

## 4. Inicialização do Banco de Dados (Prisma)

```bash
# Sincronizar o schema com o PostgreSQL
cd apps/server
npx prisma generate
npx prisma db push
cd ../..
```

---

## 5. Build e Execução em Produção

Para manter o sistema rodando sempre, utilizaremos o **PM2**:

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Build do projeto completo
npm run build

# Iniciar os serviços via PM2
pm2 start "npm run dev" --name irongrid-core
pm2 save
pm2 startup
```

---

## 6. Configurações Finais de Firewall
Certifique-se de liberar as portas necessárias no `ufw`:

```bash
sudo ufw allow 3001/tcp # Dashboard (Web)
sudo ufw allow 3002/tcp # API (Backend)
sudo ufw allow 161/udp  # SNMP Poller (Inbound)
sudo ufw allow 162/udp  # SNMP Traps (Optional)
sudo ufw enable
```

---

## 🚀 Acesso
Após a instalação, o dashboard estará disponível em:
`http://IP_DO_SERVIDOR:3001`

**Atenção:** No primeiro acesso, o sistema pode solicitar as credenciais configuradas no InfluxDB. Certifique-se de realizar o setup inicial do InfluxDB via `http://IP_DO_SERVIDOR:8086`.
