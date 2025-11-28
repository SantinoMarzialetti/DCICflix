# Usa imagen oficial de Python
FROM python:3.11-slim

# Define directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia requirements
COPY requirements.txt ./

# Instala dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copia el código de la aplicación
COPY . .

# Expone el puerto
EXPOSE 3005

# Comando para iniciar la aplicación
CMD ["python", "server.py"]
