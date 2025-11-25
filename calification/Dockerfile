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
EXPOSE 3003

# Comando para iniciar la aplicación
CMD ["npm", "start"]
