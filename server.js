const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// RabbitMQ Configuration
let rabbitmqChannel = null;
const EXCHANGE_NAME = process.env.RABBITMQ_EXCHANGE || 'events_exchange';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

// Data directory
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const WEIGHTS_FILE = path.join(DATA_DIR, 'movie_weights.json');
const PLAYED_MOVIES_FILE = path.join(DATA_DIR, 'played_movies.json');

// Asegurar que el directorio existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Cargar ponderaciones
function loadWeights() {
  try {
    if (fs.existsSync(WEIGHTS_FILE)) {
      return JSON.parse(fs.readFileSync(WEIGHTS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('⚠️  Error cargando ponderaciones:', error);
  }
  return {};
}

// Guardar ponderaciones
function saveWeights(weights) {
  try {
    fs.writeFileSync(WEIGHTS_FILE, JSON.stringify(weights, null, 2));
  } catch (error) {
    console.error('❌ Error guardando ponderaciones:', error);
  }
}

// Cargar películas reproducidas
function getPlayedMovies() {
  try {
    if (fs.existsSync(PLAYED_MOVIES_FILE)) {
      return JSON.parse(fs.readFileSync(PLAYED_MOVIES_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('⚠️  Error cargando películas reproducidas:', error);
  }
  return new Set();
}

// Guardar película como reproducida
function addPlayedMovie(movieId) {
  try {
    let played = [];
    if (fs.existsSync(PLAYED_MOVIES_FILE)) {
      played = JSON.parse(fs.readFileSync(PLAYED_MOVIES_FILE, 'utf-8'));
    }
    if (!played.includes(movieId)) {
      played.push(movieId);
      fs.writeFileSync(PLAYED_MOVIES_FILE, JSON.stringify(played, null, 2));
    }
  } catch (error) {
    console.error('❌ Error guardando película reproducida:', error);
  }
}

// Calcular bonus de similaridad
function calculateSimilarityBonus(sourceMovie, targetMovie) {
  let bonus = 0;

  // Bonus por género compartido: +0.3 por cada género
  if (sourceMovie.genre && targetMovie.genre) {
    const sharedGenres = sourceMovie.genre.filter(g => 
      targetMovie.genre.some(tg => tg.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase().includes(tg.toLowerCase()))
    ).length;
    bonus += sharedGenres * 0.3;
  }

  // Bonus por director compartido: +0.4
  if (sourceMovie.director && targetMovie.director && 
      sourceMovie.director.toLowerCase() === targetMovie.director.toLowerCase()) {
    bonus += 0.4;
  }

  // Bonus por cast compartido: +0.1 por persona
  if (sourceMovie.cast && targetMovie.cast && Array.isArray(sourceMovie.cast) && Array.isArray(targetMovie.cast)) {
    const sharedCast = sourceMovie.cast.filter(actor => 
      targetMovie.cast.some(tactor => tactor.toLowerCase() === actor.toLowerCase())
    ).length;
    bonus += sharedCast * 0.1;
  }

  return bonus;
}

// Obtener todas las películas desde la API y inicializar ponderaciones
async function initializeMovieWeights() {
  try {
    const weights = loadWeights();
    
    // Si ya hay ponderaciones inicializadas, no hacer nada
    if (Object.keys(weights).length > 50) {
      console.log('✅ Ponderaciones ya inicializadas');
      return;
    }

    console.log('📊 Inicializando ponderaciones de películas...');
    
    try {
      const response = await fetch('http://api-movies:3007/api/movies?limit=500');
      if (response.ok) {
        const data = await response.json();
        const movies = data.data || [];
        
        const initialWeight = 1.0; // Ponderación inicial igual para todas
        
        let count = 0;
        movies.forEach(movie => {
          const movieId = movie._id;
          if (!weights[movieId]) {
            weights[movieId] = {
              movieName: movie.title || movie.movieName,
              totalWeight: initialWeight,
              initialWeight: initialWeight,
              updates: []
            };
            count++;
          }
        });
        
        if (count > 0) {
          saveWeights(weights);
          console.log(`✅ ${count} nuevas películas inicializadas con ponderación ${initialWeight}`);
        }
      }
    } catch (error) {
      console.warn('⚠️  No se pudo inicializar ponderaciones desde API (puede haber fallos de red)');
    }
  } catch (error) {
    console.error('❌ Error en initializeMovieWeights:', error.message);
  }
}

// Actualizar ponderaciones - VERSIÓN SIMPLIFICADA
// Solo actualiza la película del evento, sin búsquedas relacionadas
// (porque la API de movies no filtra correctamente)
async function updateRelatedMovieWeights(sourceMovie, eventValue) {
  const weights = loadWeights();
  
  console.log(`\n🔄 Actualizando ponderación para "${sourceMovie.movieName}" (valor: ${eventValue})`);
  
  try {
    // Actualizar SOLO la película del evento
    const movieId = sourceMovie.movieId;
    if (!weights[movieId]) {
      weights[movieId] = {
        movieName: sourceMovie.movieName,
        totalWeight: 1.0,
        initialWeight: 1.0,
        updates: []
      };
    }
    
    weights[movieId].totalWeight += eventValue;
    weights[movieId].updates.push({
      timestamp: new Date().toISOString(),
      event: `user_event`,
      increase: eventValue
    });
    
    console.log(`   ✓ ${sourceMovie.movieName}: +${eventValue.toFixed(2)}`);
    console.log(`   📊 Ponderación actual: ${weights[movieId].totalWeight.toFixed(2)}`);
    
    // Guardar cambios
    saveWeights(weights);
    console.log(`✅ Actualización completada\n`);
    
  } catch (error) {
    console.error('❌ Error actualizando ponderaciones:', error);
  }
}

async function setupRabbitMQ() {
  try {
    console.log('🔌 Intentando conectar a RabbitMQ en:', RABBITMQ_URL);
    const connection = await amqp.connect(RABBITMQ_URL);
    rabbitmqChannel = await connection.createChannel();
    await rabbitmqChannel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    console.log('✅ Conectado a RabbitMQ exitosamente');
    console.log('📢 Exchange:', EXCHANGE_NAME, '(topic, durable)');
    return rabbitmqChannel;
  } catch (error) {
    console.error('❌ RabbitMQ no disponible:', error.message);
    rabbitmqChannel = null;
    return null;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// ===== Eventos RabbitMQ =====

// Evento: Película clickeada (valor: 1)
app.post('/api/events/click', async (req, res) => {
  try {
    const { movieId, movieName, cast, director, genre } = req.body;
    const event = {
      movieId,
      movieName,
      cast,
      director,
      genre,
      timestamp: new Date().toISOString()
    };
    
    console.log('📍 Evento CLICK recibido:', movieName);
    
    if (rabbitmqChannel) {
      const messageBuffer = Buffer.from(JSON.stringify(event));
      rabbitmqChannel.publish(EXCHANGE_NAME, 'movie.clicked', messageBuffer, { persistent: true });
      console.log('✅ Evento click publicado en RabbitMQ → movie.clicked');
    }
    
    // Actualizar ponderaciones (click = 1 punto)
    await updateRelatedMovieWeights(event, 1);
    
    res.json({ success: true, message: 'Evento click recibido', data: event });
  } catch (error) {
    console.error('❌ Error en endpoint click:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Evento: Película reproducida (valor: 3)
app.post('/api/events/play', async (req, res) => {
  try {
    const { movieId, movieName, cast, director, genre } = req.body;
    const event = {
      movieId,
      movieName,
      cast,
      director,
      genre,
      timestamp: new Date().toISOString()
    };
    
    console.log('▶️  Evento PLAY recibido:', movieName);
    
    if (rabbitmqChannel) {
      const messageBuffer = Buffer.from(JSON.stringify(event));
      rabbitmqChannel.publish(EXCHANGE_NAME, 'movie.played', messageBuffer, { persistent: true });
      console.log('✅ Evento play publicado en RabbitMQ → movie.played');
    }
    
    // Guardar como película reproducida
    addPlayedMovie(movieId);
    
    // Actualizar ponderaciones (play = 3 puntos)
    await updateRelatedMovieWeights(event, 3);
    
    res.json({ success: true, message: 'Evento play recibido', data: event });
  } catch (error) {
    console.error('❌ Error en endpoint play:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Evento: Película calificada
app.post('/api/events/calification', async (req, res) => {
  try {
    const { movieId, movieName, cast, director, genre, rating } = req.body;
    const event = {
      movieId,
      movieName,
      cast,
      director,
      genre,
      rating,
      timestamp: new Date().toISOString()
    };
    
    console.log('⭐ Evento CALIFICATION recibido:', movieName, '- Rating:', rating);
    
    // Determinar valor de ponderación según rating
    let ratingValue = 0;
    if (rating >= 8) {
      ratingValue = 5;
    } else if (rating >= 6) {
      ratingValue = 2;
    } else if (rating >= 4) {
      ratingValue = -2;
    } else {
      ratingValue = -4;
    }
    
    console.log(`   Ponderación según rating: ${ratingValue}`);
    
    if (rabbitmqChannel) {
      const messageBuffer = Buffer.from(JSON.stringify(event));
      rabbitmqChannel.publish(EXCHANGE_NAME, 'movie.rated', messageBuffer, { persistent: true });
      console.log('✅ Evento calification publicado en RabbitMQ → movie.rated');
    }
    
    // Actualizar ponderaciones según rating
    if (ratingValue !== 0) {
      await updateRelatedMovieWeights(event, ratingValue);
    }
    
    res.json({ success: true, message: 'Evento calification recibido', data: event });
  } catch (error) {
    console.error('❌ Error en endpoint calification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== Fin Eventos =====

// Endpoint: Obtener ponderaciones de películas
app.get('/api/weights', (req, res) => {
  try {
    const weights = loadWeights();
    const topWeights = Object.entries(weights)
      .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
      .slice(0, 20)
      .map(([movieId, data]) => ({
        movieId,
        movieName: data.movieName,
        totalWeight: data.totalWeight,
        updates: data.updates ? data.updates.length : 0
      }));
    
    res.json({
      success: true,
      totalMovies: Object.keys(weights).length,
      topWeights,
      allWeights: weights
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Obtener recomendaciones desde el recommender
app.get('/api/recommendations', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const response = await fetch(`http://recommender:3005/api/recommendations?limit=${limit}`);
    
    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      res.status(response.status).json({ success: false, error: 'Recommender service unavailable' });
    }
  } catch (error) {
    console.error('❌ Error obteniendo recomendaciones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Obtener recomendaciones por género
app.get('/api/recommendations/genre', async (req, res) => {
  try {
    const genres = req.query.genres || '';
    const limit = req.query.limit || 5;
    const response = await fetch(`http://recommender:3005/api/recommendations/genre?genres=${genres}&limit=${limit}`);
    
    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      res.status(response.status).json({ success: false, error: 'Recommender service unavailable' });
    }
  } catch (error) {
    console.error('❌ Error obteniendo recomendaciones por género:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Obtener analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const response = await fetch('http://recommender:3005/api/analytics');
    
    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      res.status(response.status).json({ success: false, error: 'Recommender service unavailable' });
    }
  } catch (error) {
    console.error('❌ Error obteniendo analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Iniciar servidor con RabbitMQ
async function startServer() {
  // Intentar conectar a RabbitMQ (opcional)
  await setupRabbitMQ().catch(err => {
    console.warn('⚠️ Continuando sin RabbitMQ...');
  });
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
  
  // Inicializar ponderaciones de películas (sin bloquear)
  initializeMovieWeights().catch(err => {
    console.warn('⚠️ Error inicializando ponderaciones:', err.message);
  });
}

startServer();
