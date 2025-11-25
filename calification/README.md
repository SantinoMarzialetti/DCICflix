# Events Hub Microservice - DCICflix

Sistema centralizado para capturar, procesar y encolar eventos de usuario (clicks, calificaciones y reproducciones de películas).

## Descripción

El Events Hub es un **microservicio centralizado** que:
- Recibe eventos del frontend (clicks, calificaciones, reproducciones)
- Los persiste en MongoDB
- Los publica en colas de RabbitMQ
- Proporciona estadísticas de películas

## Características

✅ **Monousuario** - No hay gestión de usuarios  
✅ **3 tipos de eventos** - Clicks, calificaciones, reproducciones  
✅ **3 colas separadas** en RabbitMQ  
✅ **Estadísticas** de películas  
✅ **Persistencia** en MongoDB  

## Instalación

1. **Instalar dependencias**:
```bash
npm install
```

2. **Configurar variables de entorno**:
```bash
cp .env.example .env
```

3. **Editar `.env` si es necesario** (valores por defecto funcionan localmente)

## Prerequisitos

- Node.js v14+
- MongoDB corriendo en `localhost:27017`
- RabbitMQ corriendo en `localhost:5672`

## Ejecución

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

## API Endpoints

### Procesar Evento (POST)
**POST** `/api/events/`

Procesa cualquier tipo de evento (click, calification, play)

#### Ejemplo 1: Registrar un Click
```json
{
  "type": "click",
  "data": {
    "movieId": "550",
    "movieName": "Fight Club",
    "cast": ["Brad Pitt", "Edward Norton"],
    "director": "David Fincher",
    "genre": ["Drama", "Thriller"]
  }
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "Evento click procesado exitosamente",
  "data": {
    "_id": "...",
    "movieId": "550",
    "movieName": "Fight Club",
    "cast": [...],
    "director": "David Fincher",
    "genre": [...]
  }
}
```

#### Ejemplo 2: Registrar Calificación
```json
{
  "type": "calification",
  "data": {
    "movieId": "550",
    "movieName": "Fight Club",
    "cast": ["Brad Pitt", "Edward Norton"],
    "director": "David Fincher",
    "genre": ["Drama", "Thriller"],
    "rating": 10
  }
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "Evento calification procesado exitosamente",
  "data": {
    "_id": "...",
    "movieId": "550",
    "movieName": "Fight Club",
    "cast": ["Brad Pitt", "Edward Norton"],
    "director": "David Fincher",
    "genre": ["Drama", "Thriller"],
    "rating": 10
  }
}
```

#### Ejemplo 3: Registrar Play/Reproducción
```json
{
  "type": "play",
  "data": {
    "movieId": "550",
    "movieName": "Fight Club",
    "cast": ["Brad Pitt", "Edward Norton"],
    "director": "David Fincher",
    "genre": ["Drama", "Thriller"]
  }
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "Evento play procesado exitosamente",
  "data": {
    "_id": "...",
    "movieId": "550",
    "movieName": "Fight Club",
    "cast": ["Brad Pitt", "Edward Norton"],
    "director": "David Fincher",
    "genre": ["Drama", "Thriller"]
  }
}
```

### Obtener Estadísticas de Película (GET)
**GET** `/api/events/movie/:movieId/stats`

Retorna estadísticas agregadas de una película

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "movieId": "550",
    "clicks": 15,
    "plays": 8,
    "rating": 10
  }
}
```

### Health Check
**GET** `/health`

Verifica que el servicio está activo

**Response (200)**:
```json
{
  "status": "Events Hub service is running"
}
```

## Flujo de Datos

```
Frontend (UI)
      ↓
   POST /api/events
      ↓
  Event Service
   ↙  ↓  ↘
Click │ Calification │ Play
  ↓    ↓    ↓
RabbitMQ  (3 colas)
  ↓    ↓    ↓
clicks_queue, califications_queue, plays_queue
  ↓    ↓    ↓
MongoDB
```

## Colas de RabbitMQ

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

## Errores Comunes

### Error 400: "Los campos 'type' y 'data' son obligatorios"
- Asegúrate de enviar ambos campos en el request
- `type` debe ser: "click", "calification" o "play"

### Error 400: "El rating debe ser un número entero entre 1 y 10"
- El rating debe estar entre 1 y 10
- Debe ser un número entero, no decimal

### Error: "MongooseError: The `uri` parameter must be a string"
- Asegúrate de que MONGODB_URI está configurada en .env

### Error: "Cannot connect to RabbitMQ"
- Verifica que RabbitMQ está corriendo: `netstat -ano | findstr ":5672"`

## Verificación en RabbitMQ

Accede a: `http://localhost:15672`  
Usuario: `guest`  
Contraseña: `guest`

Ve a **Queues** para ver las colas y los eventos encolados.

## Desarrollo Futuro

- [ ] Autenticación y autorización
- [ ] Rate limiting
- [ ] Validación más estricta de datos
- [ ] Retry logic mejorado
- [ ] Metrics y monitoring
- [ ] Paginación en estadísticas

## Contacto

Para preguntas o reportar bugs, contacta al equipo de desarrollo.
