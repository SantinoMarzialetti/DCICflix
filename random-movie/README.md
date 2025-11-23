# Random Movie Microservice

Microservicio que proporciona películas aleatorias del catálogo de TMDB.

## Características

- Genera una colección de películas aleatorias
- Mantiene un cache de IDs de películas populares
- Actualización automática del cache cada hora
- API RESTful simple

## Endpoints

### GET /api/random-movies
Obtiene múltiples películas aleatorias.

**Query Parameters:**
- `count` (opcional): Número de películas a retornar (default: 10)

**Ejemplo:**
```
GET http://localhost:3001/api/random-movies?count=5
```

### GET /api/random-movie
Obtiene una sola película aleatoria.

**Ejemplo:**
```
GET http://localhost:3001/api/random-movie
```

### GET /api/health
Health check del servicio.

## Instalación

```bash
npm install
```

## Ejecución

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## Puerto

Por defecto: `3001`
