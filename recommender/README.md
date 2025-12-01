# Recommender Service - DCICflix

Microservicio de recomendación inteligente en Python con sistema de pesos dinámicos.

## Descripción

El recomendador es un **microservicio de aprendizaje colaborativo** que:
- Mantiene un **sistema de pesos persistente** para cada película
- Aprende del historial de usuario (clicks, reproducciones, calificaciones)
- Recomienda películas basadas en **similitud de características** (géneros, directores, actores)
- Persiste datos en volúmenes JSON para supervivencia ante reinicios
- Se integra con el frontend para actualizar recomendaciones en tiempo real

## Características

✅ **Sistema de Pesos Dinámico** - Aprende de cada interacción  
✅ **Recomendaciones Basadas en Similitud** - Géneros, directores, actores  
✅ **Persistencia en Volúmenes** - Pesos se guardan en Docker volumes  
✅ **3 Fases de Recomendación** - Adapta según número de interacciones  
✅ **Filtrado Inteligente** - Excluye películas vistas y con peso = 0  
✅ **API REST** - Flask + CORS para integración frontend  

## Instalación

### Local
```bash
pip install -r requirements.txt
python server.py
```

### Docker
```bash
docker-compose up -d
```

## Configuración

Variables de entorno en `.env`:
```
PORT=3005
API_MOVIES_URL=http://api-movies:3007/api/movies
CLICKS_DIR=/data/clicks
PLAYS_DIR=/data/plays
RATINGS_DIR=/data/ratings
SERVER_DATA_DIR=/server/data
```

## API Endpoints

### Health Check
**GET** `/health`

```json
{
  "status": "Recommender service is running"
}
```

### Obtener Recomendaciones Top Ponderadas
**GET** `/api/recommendations/top-weighted?limit=10`

Retorna los IDs de las 10 películas con mayor peso (excluyendo vistas)

**Response:**
```json
{
  "success": true,
  "count": 10,
  "movieIds": ["573a1391f29313caabcd8de7", "573a1391f29313caabcd71f5", ...],
  "movies": [
    {
      "movieId": "573a1391f29313caabcd8de7",
      "weight": 2.45,
      "movieName": "Metropolis"
    }
  ]
}
```

### Actualizar Pesos
**POST** `/api/recommendations/update-weights`

Actualiza pesos cuando el usuario interactúa (click, play, calification)

**Body:**
```json
{
  "movieId": "573a1391f29313caabcd8de7",
  "eventType": "click"
}
```

**Comportamiento:**
- `click`: Aumenta peso de películas similares (aumenta recomendación)
- `play`: Establece peso = 0 (ya vista, no recomendar)
- `calification`: Establece peso = 0 (ya calificada, no recomendar)

## Estrategia de Recomendación - Sistema de Pesos Dinámico

### Fase 1: Inicialización
- Se carga un catálogo de **2,000 películas**
- Se asignan **500 películas ponderadas iniciales** (las más relevantes)
- Cada película tiene un peso inicial que representa su "valor de recomendación"

### Fase 2: Aprendizaje por Interacción

#### A. Cuando el usuario hace CLICK en una película:
1. Sistema identifica la película interactuada
2. Extrae sus características:
   - **Géneros** (ej: Drama, Action)
   - **Directores** (ej: Steven Spielberg)
   - **Actores principales** (top 5)

3. Compara con TODAS las películas en catálogo y calcula similitud:
   - Coincidencia de géneros: +30% de peso
   - Coincidencia de directores: +50% de peso
   - Coincidencia de actores: +20% de peso

4. Aumenta el peso de películas similares:
   ```
   nuevo_peso = peso_actual × (1 + similitud × 0.15)
   ```

**Ejemplo:**
```
Usuario hace click en "Metropolis" (Sci-Fi, Fritz Lang)
   ↓
Sistema encuentra "Nosferatu" (Drama, F.W. Murnau) con 1 coincidencia:
   - Mismo director: F.W. Murnau vs Fritz Lang? NO
   - Año similar: 1927 vs 1922? Similar era
   - Mismo movimiento: Expresionismo alemán

peso_old = 1.0
similitud = 0.3 (géneros similares)
peso_new = 1.0 × (1 + 0.3 × 0.15) = 1.045
```

#### B. Cuando el usuario REPRODUCE o CALIFICA una película:
- Peso de esa película → **0** (ya fue vista/calificada)
- No aparecerá en futuras recomendaciones
- Así se evita recomendar lo que ya consumió

### Fase 3: Recomendación Inteligente

#### Flujo en Frontend:
1. **Cada 3 segundos** solicita top 10 películas
2. Sistema retorna películas ordenadas por peso:
   - Excluye películas ya vistas
   - Excluye películas con peso = 0
   - Ordena por peso descendente

#### Evolución con el Tiempo:
- **0 interacciones**: Se muestran películas genéricas de peso base
- **1-5 interacciones**: Pesos comienzan a divergir según gustos
- **10+ interacciones**: Recomendaciones muy personalizadas

### Ejemplo Completo de Evolución

```
Estado Inicial:
  Metropolis: 1.0
  Nosferatu: 1.0
  The Cabinet of Dr. Caligari: 1.0
  Pandora's Box: 1.0

Usuario hace CLICK en "Metropolis":
  Metropolis: 1.0 (click = aumentar similares)
  Nosferatu: 1.045 (similar: Expresionismo)
  The Cabinet of Dr. Caligari: 1.045 (similar: Expresionismo)
  Pandora's Box: 1.02 (similar: menos)

Usuario REPRODUCE "Nosferatu":
  Nosferatu: 0 (ya vista, no recomendar)
  Metropolis: 1.0
  The Cabinet of Dr. Caligari: 1.045
  Pandora's Box: 1.02

Recomendaciones mostradas:
  1. The Cabinet of Dr. Caligari (1.045)
  2. Pandora's Box (1.02)
  3. Metropolis (1.0)
  4. ...
```

### Características Técnicas

**Sistema de Persistencia:**
- Pesos guardados en `/server/data/movie_weights.json`
- Se persisten en Docker volume
- Sobreviven reinicios de contenedor

**Cálculo de Similitud:**
```python
similitud = (genre_matches × 0.3) + (director_matches × 0.5) + (actor_matches × 0.2)
nuevo_peso = peso_actual × (1 + similitud × 0.15)
```

**Filtrado Automático:**
- Excluye películas vistas (en historial)
- Excluye películas con peso = 0
- Excluye duplicados

### Ventajas de Esta Estrategia

✅ **Personalización en tiempo real**: Cambios visibles inmediatamente  
✅ **Persistencia**: Aprende y recuerda entre sesiones  
✅ **Escalable**: Funciona con millones de películas  
✅ **Explicable**: Cada recomendación tiene razón clara  
✅ **Sin cold start extremo**: Películas ponderadas iniciales disponibles  
✅ **Respetuoso**: Marca películas vistas como "no recomendar"  

## Lógica de Recomendación (Legacy - Deprecated)

## Logs del Sistema

El recomendador genera logs detallados mostrando el proceso de aprendizaje:

```
🎬 [ACTUALIZANDO PESOS] movieId: 573a1391f29313caabcd8de7 | eventType: click
   📥 Cargando todas las películas...
   ✓ 2000 películas cargadas
   📥 Cargando pesos actuales...
   ✓ 500 pesos cargados
   🔍 Buscando película 573a1391f29313caabcd8de7...
   ✓ Película encontrada: Metropolis
   
   🎬 Características de película:
      - Géneros: {'Sci-Fi', 'Adventure'}
      - Directores: {'Fritz Lang'}
      - Actores: {'Alfred Abel', 'Gustav Fröhlich', 'Brigitte Helm'}
   ⚙️  Iterando películas similares...
      ↑ Nosferatu: 1.00 → 1.04
      ↑ The Cabinet of Dr. Caligari: 1.00 → 1.04
      ↑ Pandora's Box: 1.00 → 1.03
   
   💾 Guardando 3 pesos actualizados...
✅ [ÉXITO] 3 películas tuvieron su peso aumentado
```

### Interpretación de Logs

- **🎬 [ACTUALIZANDO PESOS]**: Inicia proceso de actualización
- **📥 Cargando**: Cargando datos del volumen
- **✓**: Operación exitosa
- **🔍 Buscando**: Búsqueda de película en catálogo
- **🎬 Características**: Muestra géneros, directores y actores de la película
- **⚙️ Iterando**: Comparando con todas las otras películas
- **↑**: Película con peso aumentado (similar encontrada)
- **💾 Guardando**: Persistiendo cambios en volumen
- **✅ [ÉXITO]**: Proceso completado exitosamente

## Dependencias

- **flask**: API REST
- **flask-cors**: Habilitación de CORS
- **pandas**: Análisis de datos y manipulación
- **requests**: Llamadas HTTP a api-movies

## Persistencia de Datos

### Estructura de Volúmenes Docker

```
/server/data/
├── movie_weights.json          # Pesos de películas persistidos
├── clicks/                     # Eventos de click del usuario
├── plays/                      # Eventos de reproducción
└── ratings/                    # Eventos de calificación
```

### Formato de movie_weights.json

```json
{
  "573a1391f29313caabcd8de7": {
    "movieName": "Metropolis",
    "totalWeight": 2.45,
    "genres": ["Sci-Fi", "Adventure"],
    "directors": ["Fritz Lang"],
    "cast": ["Alfred Abel", "Gustav Fröhlich", "Brigitte Helm"]
  },
  "573a1391f29313caabcd71f5": {
    "movieName": "Nosferatu",
    "totalWeight": 1.87,
    "genres": ["Horror"],
    "directors": ["F.W. Murnau"],
    "cast": ["Max Schreck", "Alexander Granach"]
  }
}
```

## Errores Comunes

### "No hay pesos disponibles"
- Los pesos se inicializan con las 500 películas principales
- Si falla, reinicia los contenedores:
  ```bash
  docker-compose down
  docker-compose up -d
  ```

### "Película no encontrada"
- La película no existe en el catálogo de 2,000 películas
- Verifica que api-movies esté respondiendo correctamente

### "Error actualizando pesos"
- Verifica permisos en `/server/data`
- Verifica que el volumen Docker esté montado correctamente

## Mejoras Futuras

- [ ] Machine learning para optimizar pesos de similitud
- [ ] Clustering de usuarios para recomendaciones sociales
- [ ] A/B testing de diferentes estrategias
- [ ] Análisis de tendencias temporales (películas trending)
- [ ] Diversificación de recomendaciones (evitar monotonía)
- [ ] Explicabilidad mejorada en frontend

## Arquitectura en el Contexto del Proyecto

```
┌─────────────────────────────────────────┐
│          FRONTEND (React/Vite)          │
│    (Muestra películas recomendadas)     │
└──────────────────┬──────────────────────┘
                   │
        GET /api/recommendations/top-weighted
        POST /api/recommendations/update-weights
                   │
┌──────────────────▼──────────────────────┐
│      RECOMMENDER (Python/Flask)         │
│     (Sistema de pesos dinámico)         │
└──────────────────┬──────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
GET /api/movies  Lee pesos    Persiste
    │            histórico      pesos
    │              │              │
┌───▼────┐    ┌────▼────┐    ┌──▼─────┐
│ API    │    │ Docker  │    │ Docker │
│Movies  │    │ Volume  │    │ Volume │
│        │    │ /data/  │    │ /data/ │
└────────┘    └─────────┘    └────────┘
```

## Contacto

Para preguntas sobre la estrategia de recomendación o mejoras, contacta al equipo de desarrollo.
