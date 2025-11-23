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
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL;

const tmdbHeaders = {
  Authorization: `Bearer ${TMDB_API_KEY}`,
  'Content-Type': 'application/json'
};

// Cache para películas populares (para obtener IDs válidos)
let movieIdsCache = [];
let lastCacheUpdate = 0;
const CACHE_DURATION = 3600000; // 1 hora en milisegundos

// Función para actualizar el cache de IDs de películas
async function updateMovieIdsCache() {
  try {
    const now = Date.now();
    if (movieIdsCache.length > 0 && (now - lastCacheUpdate) < CACHE_DURATION) {
      return movieIdsCache;
    }

    console.log('Actualizando cache de IDs de películas...');
    const pages = [1, 2, 3, 4, 5]; // Obtener las primeras 5 páginas (100 películas)
    const allIds = [];

    for (const page of pages) {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
        headers: tmdbHeaders,
        params: { language: 'es-ES', page }
      });
      const ids = response.data.results.map(movie => movie.id);
      allIds.push(...ids);
    }

    movieIdsCache = allIds;
    lastCacheUpdate = now;
    console.log(`Cache actualizado con ${movieIdsCache.length} películas`);
    return movieIdsCache;
  } catch (error) {
    console.error('Error actualizando cache:', error.message);
    return movieIdsCache;
  }
}

// Función para obtener IDs aleatorios
function getRandomMovieIds(count = 10) {
  const shuffled = [...movieIdsCache].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Función para obtener detalles de películas por IDs
async function getMoviesByIds(ids) {
  const promises = ids.map(id =>
    axios.get(`${TMDB_BASE_URL}/movie/${id}`, {
      headers: tmdbHeaders,
      params: { language: 'es-ES' }
    }).catch(err => {
      console.error(`Error obteniendo película ${id}:`, err.message);
      return null;
    })
  );

  const results = await Promise.all(promises);
  return results.filter(res => res !== null).map(res => res.data);
}

// Ruta principal: Obtener películas aleatorias
app.get('/api/random-movies', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 10;
    
    // Actualizar cache si es necesario
    await updateMovieIdsCache();

    if (movieIdsCache.length === 0) {
      return res.status(500).json({ error: 'No se pudieron obtener películas' });
    }

    // Obtener IDs aleatorios
    const randomIds = getRandomMovieIds(count);

    // Obtener detalles de las películas
    const movies = await getMoviesByIds(randomIds);

    res.json({
      success: true,
      count: movies.length,
      movies
    });
  } catch (error) {
    console.error('Error en /api/random-movies:', error.message);
    res.status(500).json({ error: 'Error obteniendo películas aleatorias' });
  }
});

// Ruta para obtener una sola película aleatoria
app.get('/api/random-movie', async (req, res) => {
  try {
    await updateMovieIdsCache();

    if (movieIdsCache.length === 0) {
      return res.status(500).json({ error: 'No se pudo obtener una película' });
    }

    const randomId = movieIdsCache[Math.floor(Math.random() * movieIdsCache.length)];
    const response = await axios.get(`${TMDB_BASE_URL}/movie/${randomId}`, {
      headers: tmdbHeaders,
      params: { language: 'es-ES' }
    });

    res.json({
      success: true,
      movie: response.data
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
    cachedMovies: movieIdsCache.length,
    lastUpdate: new Date(lastCacheUpdate).toISOString()
  });
});

// Inicializar cache al arrancar
updateMovieIdsCache().then(() => {
  app.listen(PORT, () => {
    console.log(`🎬 Random Movie Service running on http://localhost:${PORT}`);
  });
});
