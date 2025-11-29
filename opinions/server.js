const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
const { setupRabbitMQ, consumeMessages } = require('./rabbitmq/connection');

const app = express();
const PORT = process.env.PORT || 3004;

// Variable para almacenar conexión a Atlas
let atlasConnection = null;

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ status: 'Opiniones service is running' });
});

// Endpoint para actualizar rating en Atlas
app.post('/api/update-rating', async (req, res) => {
  try {
    const { movieId, rating } = req.body;

    if (!movieId || !rating) {
      return res.status(400).json({ 
        success: false, 
        error: 'movieId y rating son requeridos' 
      });
    }

    if (!atlasConnection) {
      return res.status(503).json({ 
        success: false, 
        error: 'Conexión a Atlas no disponible' 
      });
    }

    // Obtener película actual de Atlas
    const moviesCollection = atlasConnection.collection('movies');
    
    const movie = await moviesCollection.findOne({ 
      _id: mongoose.Types.ObjectId.isValid(movieId) 
        ? new mongoose.Types.ObjectId(movieId) 
        : movieId 
    });
    
    if (!movie) {
      return res.status(404).json({ 
        success: false, 
        error: `Película no encontrada: ${movieId}` 
      });
    }

    // Calcular nuevo rating
    const currentVotes = movie.imdb?.votes || 0;
    const currentRating = movie.imdb?.rating || 0;
    const newVotes = currentVotes + 1;
    const calculatedRating = ((currentRating * currentVotes) + rating) / newVotes;

    // Actualizar en Atlas
    await moviesCollection.updateOne(
      { _id: movie._id },
      {
        $set: {
          'imdb.rating': parseFloat(calculatedRating.toFixed(1)),
          'imdb.votes': newVotes
        }
      }
    );

    console.log(`✓ Rating actualizado en Atlas - Película: ${movie.title}, Nuevo rating: ${calculatedRating.toFixed(1)}, Votos: ${newVotes}`);

    res.json({ 
      success: true, 
      movie: movie.title,
      newRating: calculatedRating.toFixed(1),
      newVotes: newVotes
    });
  } catch (error) {
    console.error('✗ Error actualizando rating en Atlas:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Conectar a MongoDB Atlas y RabbitMQ
async function startServer() {
  try {
    // Conectar a MongoDB Atlas
    try {
      atlasConnection = await mongoose.createConnection(process.env.MONGODB_URI_ATLAS, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✓ Conectado a MongoDB Atlas');
    } catch (atlasError) {
      console.warn('⚠️  No se pudo conectar a Atlas (calificaciones desactivadas):', atlasError.message);
    }

    // Conectar a RabbitMQ y empezar a consumir
    await setupRabbitMQ();
    console.log('✓ Conectado a RabbitMQ');

    // Iniciar consumo de mensajes
    await consumeMessages();
    console.log('✓ Consumer iniciado');

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`✓ Opiniones ejecutándose en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('✗ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
