#!/bin/bash

echo "--- 🚀 INICIANDO DEPLOY ARKAAN (COM BACKUP) ---"

# --- DEFINIÇÕES DE CAMINHO ---
TARGET_DIR="/var/www/arkaan.whaledigital.site/html"
BACKUP_BASE_DIR="/var/www/arkaan.whaledigital.site/backups"
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
BACKUP_DIR="$BACKUP_BASE_DIR/$TIMESTAMP"
SOURCE_DIR="dist"


# 1. Puxa as últimas mudanças do repositório Git
echo "1. Puxando as últimas mudanças do Git..."
git pull

# 2. Instala dependências e faz o Build de produção
echo "2. Instalando dependências e gerando novo build..."
# Instala o módulo 'react-easy-crop' e todos os outros faltantes:
npm install 
npm run build


# --- PASSO DE BACKUP ---
if [ -d "$TARGET_DIR" ] && [ "$(ls -A $TARGET_DIR)" ]; then
    echo "3. Criando backup da versão atual em $BACKUP_DIR"
    sudo mkdir -p $BACKUP_DIR
    # Move o conteúdo atual para a pasta de backup
    sudo mv $TARGET_DIR/* $BACKUP_DIR/ 
    # Move também os arquivos ocultos (se houver)
    sudo mv $TARGET_DIR/.[!.]* $BACKUP_DIR/ 2>/dev/null
else
    echo "3. Diretório de destino vazio ou inexistente. Pulando backup."
    sudo mkdir -p $TARGET_DIR
fi


# --- NOVO DEPLOY ---
echo "4. Copiando novos arquivos para $TARGET_DIR..."

# Copia os novos arquivos de build (da pasta 'dist') para o destino final
sudo cp -r $SOURCE_DIR/* $TARGET_DIR/

# 5. Ajusta o proprietário e as permissões de segurança para o Nginx
echo "5. Ajustando permissões..."
sudo chown -R www-data:www-data $TARGET_DIR
sudo chmod -R 755 $TARGET_DIR

# 6. Limpa o cache do Nginx
echo "6. Reiniciando Nginx."
sudo systemctl reload nginx

echo "--- ✅ DEPLOY CONCLUÍDO! Backup pronto para Rollback: $TIMESTAMP ---"
