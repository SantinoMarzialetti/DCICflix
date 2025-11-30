# Usa imagen oficial de Node.js
FROM node:18-alpine

# Define directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala dependencias
RUN npm install --production

# Copia el código de la aplicación
COPY . .

# Expone el puerto
EXPOSE 3005

# Healthcheck
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3005/api/health || exit 1

# Comando para iniciar la aplicación
CMD ["npm", "start"]
