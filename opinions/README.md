# Opiniones Microservice - DCICflix

Microservicio consumer que lee eventos de RabbitMQ y persiste en MongoDB.

## Descripción

Opiniones es un **microservicio consumer** que:
- Consume eventos de las colas de RabbitMQ (clicks, calificaciones, reproducciones)
- Persiste los eventos en MongoDB
- Mantiene un historial de eventos de usuarios

## Características

✅ **Consumer de RabbitMQ** - Lee de 3 colas diferentes  
✅ **Persistencia en MongoDB** - Almacena todos los eventos  
✅ **Modelos de datos** - Click, Calification, Play  
✅ **Health check** - Endpoint para verificar estado  

## Instalación

1. **Instalar dependencias**:
```bash
npm install
```

2. **Configurar variables de entorno**:
```bash
cp .env.example .env
```

3. **Editar `.env` si es necesario** (en docker-compose está configurado automáticamente)

## Prerequisitos

- Node.js v14+
- MongoDB corriendo
- RabbitMQ corriendo
- Las colas creadas (Calification se encarga de crearlas)

## Ejecución

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

### Con Docker Compose
```bash
docker-compose up
```

## Flujo de Datos

```
RabbitMQ (3 colas)
  ↓    ↓    ↓
clicks_queue, califications_queue, plays_queue
  ↓    ↓    ↓
Opiniones Consumer
  ↓    ↓    ↓
MongoDB (Persistencia)
```

## Colas Consumidas

| Cola | Routing Key | Contenido |
|------|------------|-----------|
| `clicks_queue` | `movie.clicked` | { movieId, movieName, cast, director, genre } |
| `califications_queue` | `movie.rated` | { movieId, movieName, cast, director, genre, rating } |
| `plays_queue` | `movie.played` | { movieId, movieName, cast, director, genre } |

## Modelos de Datos

### Click
```javascript
{
  _id: ObjectId,
  movieId: String (required),
  movieName: String (required),
  cast: [String],
  director: String,
  genre: [String]
}
```

### Calification
```javascript
{
  _id: ObjectId,
  movieId: String (required),
  movieName: String (required),
  cast: [String],
  director: String,
  genre: [String],
  rating: Number (1-10, required, entero)
}
```

### Play
```javascript
{
  _id: ObjectId,
  movieId: String (required),
  movieName: String (required),
  cast: [String],
  director: String,
  genre: [String]
}
```

## API Endpoints

### Health Check
**GET** `/health`

Verifica que el servicio está activo

**Response (200)**:
```json
{
  "status": "Opiniones service is running"
}
```

## Logs

El servicio imprime en consola:
- ✓ Eventos recibidos de RabbitMQ
- ✓ Eventos guardados en MongoDB
- ✗ Errores durante el procesamiento

Ejemplo:
```
✓ Conectado a MongoDB
✓ Conectado a RabbitMQ
✓ Consumer iniciado
📥 Click recibido: { movieId: '550', ... }
✓ Click guardado en BD
```

## Errores Comunes

### Error: "Cannot connect to RabbitMQ"
- Verifica que RabbitMQ está corriendo
- Verifica que `RABBITMQ_URL` es correcto

### Error: "Cannot connect to MongoDB"
- Verifica que MongoDB está corriendo
- Verifica que `MONGODB_URI` es correcto

### Error: "connect ECONNREFUSED"
- Los servicios no están disponibles
- Usa `docker-compose up` para levantar todo automáticamente

## Desarrollo Futuro

- [ ] Filtrado de eventos
- [ ] Búsqueda de eventos
- [ ] API de estadísticas
- [ ] Exportación de datos
- [ ] Webhooks a otros servicios

## Contacto

Para preguntas o reportar bugs, contacta al equipo de desarrollo.
