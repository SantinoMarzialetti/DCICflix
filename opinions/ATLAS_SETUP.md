# Integración con MongoDB Atlas - Actualización de Ratings

## Resumen de Cambios

Se ha modificado el servicio de **Opiniones** para que ahora:

1. **No guarda calificaciones localmente** - Las calificaciones ya no se persisten en la base de datos local
2. **Actualiza ratings en Atlas** - Cuando se recibe una calificación por RabbitMQ, se actualiza el documento en MongoDB Atlas
3. **Mantiene la lógica de clicks y plays** - Clicks y plays se siguen guardando en la base de datos local como antes

## Flujo de Actualización de Ratings

Cuando se consume una calificación de la cola `califications_queue`:

```
Calificación recibida
    ↓
Conectar a MongoDB Atlas
    ↓
Buscar película por movieId
    ↓
Calcular nuevo rating:
   Nuevo Rating = (Rating Actual × Votos Actuales + Nueva Calificación) / (Votos Actuales + 1)
    ↓
Incrementar votes en 1
    ↓
Actualizar documento en Atlas (imdb.rating y imdb.votes)
    ↓
Confirmar (ACK) mensaje en RabbitMQ
```

## Estructura Esperada en Atlas

Tu documento en MongoDB Atlas debe tener esta estructura en la colección `movies`:

```javascript
{
  "_id": ObjectId("..."),
  "title": "Nombre de la película",
  "imdb": {
    "rating": 6.2,      // Rating actual
    "votes": 1189,      // Cantidad de votos
    "id": 5
  },
  // ... otros campos
}
```

## Configuración Requerida

### 1. Actualizar `.env` en el servicio de Opiniones

```env
MONGODB_URI_ATLAS=mongodb+srv://usuario:password@cluster.mongodb.net/sample_mflix
```

Reemplaza:
- `usuario` - Tu usuario de MongoDB Atlas
- `password` - Tu contraseña
- `cluster` - Tu cluster de Atlas
- `sample_mflix` - Tu base de datos (ajusta si es diferente)

### 2. Actualizar `docker-compose.yml`

La variable `MONGODB_URI_ATLAS` ya está configurada. Solo reemplaza los valores de credenciales:

```yaml
opiniones:
  environment:
    MONGODB_URI_ATLAS: mongodb+srv://TU_USUARIO:TU_PASSWORD@cluster.mongodb.net/sample_mflix
```

## Logging

El servicio imprime logs detallados:

```
✓ Rating actualizado en Atlas - Película: Blacksmith Scene, Nuevo rating: 6.5, Votos: 1190
```

O en caso de error:

```
✗ Película no encontrada en Atlas: 573a1390f29313caabcd4135
✗ Error actualizando rating en Atlas: [error details]
```

## Cambios en el Código

### Archivo: `opinions/rabbitmq/connection.js`

**Nuevo:**
- Importación de `mongoose` para conexión a Atlas
- Variable `atlasConnection` para mantener la conexión a Atlas
- Función `updateMovieRatingInAtlas(movieId, newRating)` que:
  - Obtiene el documento actual de la película
  - Calcula el nuevo rating
  - Actualiza `imdb.rating` e `imdb.votes`

**Cambios en `setupRabbitMQ()`:**
- Se conecta a Atlas al inicializar (además de RabbitMQ)

**Cambios en consumidor de calificaciones:**
- ✗ Ya no importa ni usa el modelo `Calification`
- ✗ Ya no guarda en BD local
- ✓ Ahora llama a `updateMovieRatingInAtlas()`
- ✓ Confirma el mensaje solo si la actualización fue exitosa

## Testing

### Probar flujo completo:

1. **Asegúrate de que Atlas está accessible:**
   ```bash
   mongodb+srv://usuario:password@cluster.mongodb.net/sample_mflix
   ```

2. **Envía una calificación:**
   ```bash
   curl -X POST http://localhost:3003/api/califications \
     -H "Content-Type: application/json" \
     -d '{
       "movieId": "573a1390f29313caabcd4135",
       "movieName": "Blacksmith Scene",
       "cast": ["Charles Kayser"],
       "director": "William K.L. Dickson",
       "genre": ["Short"],
       "rating": 8
     }'
   ```

3. **Verifica los logs:**
   ```
   docker-compose logs opiniones
   ```
   Deberías ver:
   ```
   📥 Calificación recibida: {...}
   ✓ Rating actualizado en Atlas - Película: Blacksmith Scene, Nuevo rating: 7.1, Votos: 1190
   ✓ Rating actualizado en Atlas desde calificación
   ```

4. **Verifica en Atlas:**
   - Ve a tu cluster en MongoDB Atlas
   - Busca el documento por `_id`
   - Verifica que `imdb.rating` e `imdb.votes` se actualizaron

## Notas Importantes

- **Clicks y Plays**: Se siguen guardando normalmente en MongoDB local (no cambiaron)
- **Calificaciones**: Ya no se guardan localmente, solo actualizan Atlas
- **Timeout de conexión**: Si hay problemas de conexión a Atlas, aumenta el timeout en la URI con `?serverSelectionTimeoutMS=10000`
- **Errores de credenciales**: Verifica que el usuario de Atlas tenga permisos de lectura/escritura en la colección `movies`

## Detalles de la Fórmula de Rating

La nueva calificación se integra usando el promedio ponderado:

```
Nuevo Rating = (Rating Anterior × Votos Anteriores + Nueva Calificación) / (Votos Anteriores + 1)
```

**Ejemplo:**
- Rating actual: 6.2
- Votos actuales: 1189
- Nueva calificación: 8

```
Nuevo Rating = (6.2 × 1189 + 8) / (1189 + 1)
             = (7371.8 + 8) / 1190
             = 7379.8 / 1190
             = 6.2 (redondeado a 1 decimal)
```

Esto asegura que el rating se actualiza suavemente y representa el promedio ponderado de todas las calificaciones.
