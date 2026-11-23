FROM node:22-alpine

WORKDIR /app

# Instalar dependencias completas (incluye tsx necesario para migraciones y seeds)
COPY package*.json ./
RUN npm ci

# Copiar configuración y código fuente
COPY tsconfig*.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Compilar TypeScript a JavaScript en dist/
RUN npm run build

# Preparar script de entrada
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
