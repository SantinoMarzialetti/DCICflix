# Usa imagen oficial de Python
FROM python:3.11-slim

# Define directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia requirements.txt
COPY requirements.txt .

# Instala dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia el código de la aplicación
COPY . .

# Expone el puerto
EXPOSE 3005

# Healthcheck
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3005/health')" || exit 1

# Comando para iniciar la aplicación
CMD ["python", "server.py"]
