**Para levantar todos los servicios correr por consola:**
    docker-compuse up --build

**Como funciona el recomendador?**
Nosotros optamos por implementar un recomendador que tenga dos fases (hibrido), una primera donde no se conozca al usuario y se hagan recomendaciones generales, y luego de una n cantidad de interacciones del usuario con el sistema, se pasa a un recomendador personalizado que va dando peso a peliculas en base a los clicks sobre peliculas que hace el usuario, las veces que presiona reproducir en las peliculas disponibles y también en base a sus calificaciones de peliculas. Todo esto se guarda en volumenes de docker para que el recomendador sea personal para cada pc que lo use. La unica interacción que se tiene con Atlas (repositorio remoto donde se encuentra la base de datos mongoDB que usamos) es para guardar y actualizar la calificación promedio que tiene cada película. Otro detalle que agregamos es que el sistema no recomienda una película que haya sido recomendada y se haya visto. Otra cuestión que nos surgió y no llegamos a mejorar es que la actualización de la sección **recomendadas** se da cada n tiempo, no cuando se actualiza la página, es algo que queda planteado para mejorar a futuro.

# DCICflix - Sistema de Streaming de Películas con Microservicios

Una plataforma Netflix-style construida con **arquitectura de microservicios** que captura eventos de usuario (clicks, reproducciones, calificaciones) y los procesa a través de un sistema de colas con RabbitMQ.

---

## Descripción General

DCICflix es un sistema monousuario que simula una plataforma de streaming. Implementa:

- **3 tipos de eventos**: Clicks (visualizaciones), Plays (reproducciones), Calificaciones (ratings)
- **Arquitectura orientada a eventos** con RabbitMQ como mensaje broker
- **Persistencia** en MongoDB (Atlas)
- **Procesamiento distribuido** entre múltiples microservicios
- **Recomendaciones** basadas en interacciones del usuario

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vite/React)                    │
│                      (localhost:5173 - :8080)                   │
└──────────────┬──────────────────────────┬───────────────────────┘
               │                          │
        ┌──────▼────────┐         ┌──────▼──────────┐
        │  Random Movie │         │  Server/Events  │
        │   (3001)      │         │     Hub (3000)  │
        └──────┬────────┘         └────────┬────────┘
               │                          │
        ┌──────▼──────────────────────────▼─────┐
        │      RabbitMQ Message Broker (5672)   │
        │  - clicks_queue                       │
        │  - califications_queue                │
        │  - plays_queue                        │
        └──────┬──────────────────────────────┬─┘
               │                              │
    ┌──────────▼────────────┐  ┌─────────────▼──────────┐
    │  Calification Service │  │  Opinions Service      │
    │      (3003)           │  │      (3004)            │
    │  - Receives events    │  │  - Consumes events     │
    │  - Publishes to queue │  │  - Persists data       │
    │                       │  │  - Updates MongoDB     │
    └───────────────────────┘  └──────────┬─────────────┘
                                          │
                                 ┌────────▼────────────┐
                                 │  MongoDB Atlas      │
                                 │  (peliculas.movies) │
                                 │  - Ratings updated  │
                                 └─────────────────────┘
    ┌──────────────────────┐
    │  API Movies Service  │
    │       (3007)         │
    │  - Gets movie data   │
    └──────────────────────┘
    ┌──────────────────────┐
    │ Recommender Service  │
    │       (3005)         │
    │  - Top ratings       │
    │  - Top plays/clicks  │
    └──────────────────────┘
```

---

## Instalación y Setup

### Requisitos Previos

- **Docker** y **Docker Compose** instalados

##  Microservicios

### 1. **Server / Events Hub** (Puerto 3000)
```
Container: server
Puerto: 3000
Tecnología: Node.js + Express
```
**Descripción**: Servicio central que recibe eventos del frontend
- Procesa clicks, plays y calificaciones
- Publica eventos a RabbitMQ
- Mantiene estadísticas

**Endpoints principales**:
- `POST /api/events` - Registrar evento
- `GET /api/events/movie/:movieId/stats` - Obtener stats
- `GET /health` - Health check

---

### 2. **Calification Service** (Puerto 3003)
```
Container: calification
Puerto: 3003
Tecnología: Node.js + Express
```
**Descripción**: Microservicio especializado en procesar calificaciones
- Recibe calificaciones del usuario
- Publica a cola de RabbitMQ
- Actualiza ratings en MongoDB Atlas

**Endpoints**:
- `POST /api/events` - Enviar calificación
- `GET /health` - Health check

---

### 3. **Opinions Service** (Puerto 3004)
```
Container: opiniones
Puerto: 3004
Tecnología: Node.js + Express
Volúmenes:
  - clicks_data:/data/clicks
  - plays_data:/data/plays
  - ratings_data:/data/ratings
```
**Descripción**: Consumidor de eventos que persiste datos y actualiza MongoDB
- **Consumidor RabbitMQ**: Escucha las 3 colas
- **Persistencia local**: Guarda clicks y plays en volúmenes Docker
- **Actualización Atlas**: Cuando recibe calificación, hace POST a `/api/update-rating`
- **Cálculo de ratings**: Fórmula: `(old_rating × old_votes + new_rating) / (old_votes + 1)`

**Endpoints internos**:
- `POST /api/update-rating` - Actualizar rating en Atlas
- `GET /health` - Health check

---

### 4. **API Movies** (Puerto 3007)
```
Container: api-movies
Puerto: 3007
Tecnología: Node.js + Express
Base de Datos: MongoDB Atlas (peliculas)
```
**Descripción**: API que expone datos de películas
- Obtiene catálogo de películas de MongoDB Atlas
- Proporciona información para frontend y recomendaciones

**Endpoints**:
- `GET /api/movies` - Listar todas las películas
- `GET /api/movies/:id` - Obtener película específica
- `GET /health` - Health check

---

### 5. **Random Movie** (Puerto 3001)
```
Container: random-movie
Puerto: 3001
Tecnología: Node.js + Express
```
**Descripción**: Selecciona una película aleatoria
- Obtiene película random del catálogo
- Usado por frontend para sugerir película

**Endpoints**:
- `GET /` - Obtener película random
- `GET /api/random` - Película random (JSON)

---

### 6. **Recommender Service** (Puerto 3005)
```
Container: recommender
Puerto: 3005
Tecnología: Node.js + JavaScript
Volúmenes:
  - clicks_data:/data/clicks
  - plays_data:/data/plays
  - ratings_data:/data/ratings
  - server_data:/server/data
```
**Descripción**: Motor de recomendaciones basado en interacciones
- Analiza clicks, plays y calificaciones
- Genera top 10 películas recomendadas
- Recomendaciones por género

**Endpoints**:
- `GET /api/recommendations?limit=10` - Top 10 recomendadas
- `GET /api/recommendations/top-clicks?limit=10` - Top por clicks
- `GET /api/recommendations/top-plays?limit=10` - Top por plays
- `GET /api/recommendations/top-ratings?limit=10` - Top por ratings
- `GET /api/recommendations/genre?genres=Action,Comedy` - Por género
- `GET /api/analytics` - Análisis general
- `GET /api/health` - Health check

---

### 7. **Frontend (Client)** (Puerto 5173/8080)
```
Container: client
Puerto: 8080 (internamente) - 5173 (en docker-compose)
Tecnología: Vite + React/Vue
```
**Descripción**: Interfaz de usuario
- Visualización de películas
- Interacción con usuario (clicks, reproducciones, calificaciones)
- Integración con todos los microservicios

---

##  Puertos y Endpoints

| Servicio     | Puerto | Container     | Endpoint Base             |
|--------------|--------|---------------|---------------------------|
| Frontend     | 5173   | client        | http://localhost:5173     | 
| Server       | 3000   | server        | http://localhost:3000/api | 
| Random Movie | 3001   | random-movie  | http://localhost:3001/api | 
| Calification | 3003   | calification  | http://localhost:3003/api | 
| Opinions     | 3004   | opiniones     | http://localhost:3004/api | 
| Recommender  | 3005   | recommender   | http://localhost:3005/api | 
| API Movies   | 3007   | api-movies    | http://localhost:3007/api | 
| RabbitMQ AMQP| 5672   | rabbitmq      | amqp://rabbitmq:5672      |

---

##  Uso - docker-compose up

### Iniciar todos los servicios

```bash
# Levantar todos los contenedores (modo foreground)
docker-compose up

# Levantar en background
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f opiniones
```

### Parar servicios

```bash
# Parar sin eliminar datos
docker-compose down

# Parar y eliminar volúmenes (CUIDADO: pierde datos locales)
docker-compose down -v
```

### Rebuild después de cambios

```bash
# Reconstruir imágenes
docker-compose up --build

# Solo reconstruir un servicio
docker-compose up --build opiniones
```

### Verificar estado

```bash
# Ver contenedores activos
docker-compose ps

# Ver logs específicos
docker-compose logs calification

# Ejecutar comando en contenedor
docker-compose exec opiniones sh
```

---

## 🔄 Flujos de Datos

### 1. Flujo de Click (Visualización)
```
Frontend → POST /api/events {type: "click"} 
         → Server (3000)
         → RabbitMQ (clicks_queue)
         → Opinions (3004) consume
         → Archivo local: /data/clicks/*.json
         → MongoDB: Incrementa estadísticas
```

### 2. Flujo de Play (Reproducción)
```
Frontend → POST /api/events {type: "play"}
         → Server (3000)
         → RabbitMQ (plays_queue)
         → Opinions (3004) consume
         → Archivo local: /data/plays/*.json
         → Recomendador lee datos para análisis
```

### 3. Flujo de Calificación (Rating)
```
Frontend → POST /api/events {type: "calification", rating: 5}
         → Server (3000) o Calification (3003)
         → RabbitMQ (califications_queue)
         → Opinions (3004) consume
         → POST /api/update-rating
         → MongoDB Atlas (peliculas.movies)
         → Actualiza: imdb.rating y imdb.votes
         → Fórmula: (old_rating × old_votes + new_rating) / (old_votes + 1)
```

### 4. Flujo de Recomendaciones
```
Recommender (3005) lee:
  ├─ /data/clicks/*.json → Analiza popularidad
  ├─ /data/plays/*.json → Analiza reproducciones
  ├─ /data/ratings/*.json → Analiza calificaciones
  └─ MongoDB Atlas → Obtiene datos de películas
  
  Genera endpoints:
  ├─ Top 10 por interacciones
  ├─ Top 10 por ratings
  ├─ Recomendaciones por género
  └─ Estadísticas generales