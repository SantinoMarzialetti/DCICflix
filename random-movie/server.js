const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Configuration
const API_MOVIES_URL = process.env.API_MOVIES_URL || 'http://localhost:3007/api/movies';

// Cache para películas (para obtener IDs válidos)
let moviesCache = [];
let lastCacheUpdate = 0;
const CACHE_DURATION = 3600000; // 1 hora en milisegundos
let currentPage = 1; // Página actual de la API para rotación
let totalPages = 1; // Total de páginas disponibles

// Función para actualizar el cache de películas desde api-movies
async function updateMoviesCache() {
  try {
    const now = Date.now();
    
    // Verificar si el caché sigue siendo válido (menos de 1 hora)
    if (moviesCache.length > 0 && (now - lastCacheUpdate) < CACHE_DURATION) {
      return moviesCache;
    }

    console.log(`\n📥 Cargando 100 películas (página ${currentPage}/${totalPages})...`);
    
    try {
      const response = await axios.get(API_MOVIES_URL, {
        params: {
          page: currentPage,
          limit: 100
        },
        timeout: 10000
      });

      // La API retorna { success, data: [...], total, page, pages }
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        const movies = response.data.data;
        totalPages = response.data.pages || 1;
        
        moviesCache = movies;
        lastCacheUpdate = now;
        
        console.log(`✓ Cache cargado: ${movies.length} películas (página ${currentPage}/${totalPages})`);
        
        // Rotar a la siguiente página para el próximo caché
        currentPage++;
        if (currentPage > totalPages) {
          currentPage = 1; // Volver a la primera página cuando llegamos al final
        }
        
        return moviesCache;
      } else {
        console.warn('⚠️  Respuesta inesperada:', response.data);
        return moviesCache;
      }
    } catch (error) {
      console.error(`✗ Error obteniendo películas de la API:`, error.message);
      return moviesCache;
    }
  } catch (error) {
    console.error('✗ Error actualizando cache:', error.message);
    return moviesCache;
  }
}

// Función para obtener películas aleatorias del cache
function getRandomMovies(count = 10) {
  if (moviesCache.length === 0) return [];
  
  const shuffled = [...moviesCache].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Ruta principal: Obtener películas aleatorias
app.get('/api/random-movies', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 10;
    
    // Actualizar cache si es necesario
    await updateMoviesCache();

    if (moviesCache.length === 0) {
      return res.status(500).json({ error: 'No se pudieron obtener películas' });
    }

    // Obtener películas aleatorias del cache
    const randomMovies = getRandomMovies(count);

    res.json({
      success: true,
      count: randomMovies.length,
      movies: randomMovies
    });
  } catch (error) {
    console.error('Error en /api/random-movies:', error.message);
    res.status(500).json({ error: 'Error obteniendo películas aleatorias' });
  }
});

// Ruta para obtener una sola película aleatoria
app.get('/api/random-movie', async (req, res) => {
  try {
    await updateMoviesCache();

    if (moviesCache.length === 0) {
      return res.status(500).json({ error: 'No se pudo obtener una película' });
    }

    const randomMovie = moviesCache[Math.floor(Math.random() * moviesCache.length)];

    res.json({
      success: true,
      movie: randomMovie
    });
  } catch (error) {
    console.error('Error en /api/random-movie:', error.message);
    res.status(500).json({ error: 'Error obteniendo película aleatoria' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Random Movie Service is running',
    cachedMovies: moviesCache.length,
    currentPage: currentPage,
    totalPages: totalPages,
    lastUpdate: new Date(lastCacheUpdate).toISOString(),
    apiMoviesUrl: API_MOVIES_URL
  });
});

// Inicializar cache al arrancar
async function startServer() {
  let retries = 0;
  const maxRetries = 10;

  while (retries < maxRetries) {
    try {
      console.log(`Intentando cargar películas (intento ${retries + 1}/${maxRetries})...`);
      await updateMoviesCache();
      
      if (moviesCache.length > 0) {
        console.log(`✅ Conexión exitosa. ${moviesCache.length} películas cargadas.`);
        break;
      } else {
        console.log('⚠️  No se obtuvieron películas. Reintentando en 5 segundos...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}. Reintentando en 5 segundos...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      retries++;
    }
  }

  if (moviesCache.length === 0) {
    console.warn('⚠️  No se pudieron cargar películas después de varios intentos. El servicio iniciará pero sin películas en caché.');
  }

  app.listen(PORT, () => {
    console.log(`🎬 Random Movie Service running on http://localhost:${PORT}`);
    console.log(`📽️  Conectado a api-movies: ${API_MOVIES_URL}`);
    console.log(`📊 Películas en caché: ${moviesCache.length}`);
  });
}

startServer();
