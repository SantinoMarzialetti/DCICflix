# Recommender Service - DCICflix

Microservicio de recomendación híbrido en Python con pandas.

## Descripción

El recomendador es un **microservicio de IA** que:
- Implementa **2 estrategias de recomendación**:
  - **Cold Start**: Para usuarios nuevos (sin historial)
  - **Collaborative**: Basado en gustos del usuario (clicks, calificaciones, plays)
- Lee eventos del usuario desde MongoDB local
- Lee catálogo de películas desde MongoDB Atlas
- Pondera interacciones: Clicks (1x), Calificaciones (2x), Plays (3x)

## Características

✅ **Recomendador Híbrido** - Adapta estrategia según historial  
✅ **Cold Start** - Mejores películas por género  
✅ **Collaborative** - Basado en interacciones ponderadas  
✅ **Dual MongoDB** - Local para eventos, Atlas para catálogo  
✅ **Pandas + Flask** - Python puro para análisis  

## Instalación

### Local
```bash
pip install -r requirements.txt
python server.py
```

### Docker
```bash
docker build -t recommender:latest .
docker run -p 3005:3005 \
  -e MONGODB_URI_LOCAL=mongodb://localhost:27017/dcicflix_db \
  -e MONGODB_URI_ATLAS="mongodb+srv://usuario:password@cluster.mongodb.net/DCICflix" \
  recommender:latest
```

## Configuración

Edita `.env`:
```
PORT=3005
MONGODB_URI_LOCAL=mongodb://mongodb:27017/dcicflix_db
MONGODB_URI_ATLAS=mongodb+srv://usuario:password@cluster.mongodb.net/DCICflix
```

## API Endpoints

### Health Check
**GET** `/health`

```json
{
  "status": "Recommender service is running"
}
```

### Obtener Recomendaciones (Auto)
**GET** `/api/recommendations?num_recommendations=5`

Elige automáticamente entre cold start o collaborative

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "movieId": "550",
      "movieName": "Fight Club",
      "genre": "Drama",
      "reason": "Basado en tus gustos",
      "score": 9.5
    }
  ]
}
```

### Cold Start (Forzado)
**GET** `/api/recommendations/cold-start?num_recommendations=5`

Fuerza recomendación para usuario nuevo

### Collaborative (Forzado)
**GET** `/api/recommendations/collaborative?num_recommendations=5`

Fuerza recomendación basada en historial

## Lógica de Recomendación

### Estrategia Cold Start
1. Agrupa películas por género
2. Selecciona la mejor (por rating) de cada género
3. Retorna N películas (una por género preferentemente)

### Estrategia Collaborative
1. Calcula score por película:
   - Clicks: +1 punto
   - Calificaciones: +rating*2 puntos
   - Plays: +3 puntos
2. Filtra películas del mismo género (que el usuario vio)
3. Excluye películas ya vistas
4. Ordena por rating
5. Retorna top N

### Decisión de Estrategia
- Si < 2 interacciones → Cold Start
- Si ≥ 2 interacciones → Collaborative

## Logs

El servicio imprime:
```
=== RECOMENDADOR ===
📊 Interacciones del usuario: 15
   - Clicks: 8
   - Calificaciones: 4
   - Plays: 3
📊 Modo COLLABORATIVE: Con historial de usuario
✓ 5 películas recomendadas (collaborative)
===================
```

## Dependencias

- **flask**: API REST
- **pandas**: Análisis de datos
- **pymongo**: Conexión a MongoDB
- **python-dotenv**: Variables de entorno

## MongoDB

### Local (eventos)
- Base: `dcicflix_db`
- Colecciones: `clicks`, `califications`, `plays`

### Atlas (catálogo)
- Base: `DCICflix`
- Colección: `movies`
- Campos esperados: `_id`, `movieName`, `genre`, `rating`

## Errores Comunes

### "Cannot connect to MongoDB"
- Verifica que MongoDB está corriendo
- Verifica credenciales de Atlas en `.env`

### "No hay películas en el catálogo"
- Verifica que el catálogo existe en Atlas
- Verifica conexión a Atlas

## Mejoras Futuras

- [ ] Filtrado por género específico
- [ ] Detalles de razón de recomendación
- [ ] Caching de recomendaciones
- [ ] Content-based filtering
- [ ] Matrix factorization
- [ ] A/B testing de estrategias

## Contacto

Para preguntas o mejoras, contacta al equipo de desarrollo.
