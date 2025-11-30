# API Movies Microservicio

Microservicio que se encarga de realizar consultas a la base de datos MongoDB Atlas de películas.

## Instalación

```bash
npm install
```



## Desarrollo

```bash
npm run dev
```

## Producción

```bash
npm start
```

## Endpoints

### Obtener todas las películas
```
GET /api/movies?page=1&limit=10&title=&genre=&year=&minRating=
```

Parámetros opcionales:
- `page`: Número de página (default: 1)
- `limit`: Películas por página (default: 10)
- `title`: Buscar por título
- `genre`: Filtrar por género
- `year`: Filtrar por año
- `minRating`: Filtrar por calificación mínima

### Obtener película por ID
```
GET /api/movies/:id
```

### Buscar películas por título
```
GET /api/movies/search/title/:title
```

### Obtener películas por género
```
GET /api/movies/genre/:genre
```

### Obtener películas populares
```
GET /api/movies/popular/:limit?
```

Parámetro opcional:
- `limit`: Cantidad de películas (default: 10)

### Obtener géneros disponibles
```
GET /api/movies/genres/available/list
```

### Health Check
```
GET /health
```

## Estructura del Proyecto

```
api-movies/
├── db/
│   └── connection.js      # Conexión a MongoDB
├── services/
│   └── movieService.js    # Lógica de negocio
├── routes/
│   └── movieRoutes.js     # Rutas de la API
├── server.js              # Servidor principal
├── package.json
├── .env.example
├── Dockerfile
└── README.md
```

## Respuestas

### Éxito
```json
{
  "success": true,
  "data": [...],
  "count": 10
}
```

### Error
```json
{
  "success": false,
  "message": "Descripción del error"
}
```

## Docker

Construir la imagen:
```bash
docker build -t api-movies .
```

Ejecutar el contenedor:
```bash
docker run -p 3004:3004 -e MONGODB_URI=mongodb+srv://... api-movies
```
