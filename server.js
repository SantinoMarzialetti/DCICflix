const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');
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

// Evento: Película clickeada
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
    console.log('   rabbitmqChannel disponible:', !!rabbitmqChannel);
    
    if (rabbitmqChannel) {
      const messageBuffer = Buffer.from(JSON.stringify(event));
      rabbitmqChannel.publish(EXCHANGE_NAME, 'movie.clicked', messageBuffer, { persistent: true });
      console.log('✅ Evento click publicado en RabbitMQ → movie.clicked');
    } else {
      console.warn('⚠️  RabbitMQ no disponible para click');
    }
    
    res.json({ success: true, message: 'Evento click recibido', data: event });
  } catch (error) {
    console.error('❌ Error en endpoint click:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Evento: Película reproducida
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
    console.log('   Detalles:', { movieId, cast, director, genre });
    
    if (rabbitmqChannel) {
      const messageBuffer = Buffer.from(JSON.stringify(event));
      rabbitmqChannel.publish(EXCHANGE_NAME, 'movie.played', messageBuffer, { persistent: true });
      console.log('✅ Evento play publicado en RabbitMQ → movie.played');
    } else {
      console.warn('⚠️  RabbitMQ no disponible para play');
    }
    
    res.json({ success: true, message: 'Evento play recibido', data: event });
  } catch (error) {
    console.error('❌ Error enviando evento play:', error);
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
    console.log('   Detalles:', { movieId, cast, director, genre });
    
    if (rabbitmqChannel) {
      const messageBuffer = Buffer.from(JSON.stringify(event));
      rabbitmqChannel.publish(EXCHANGE_NAME, 'movie.rated', messageBuffer, { persistent: true });
      console.log('✅ Evento calification publicado en RabbitMQ → movie.rated');
    } else {
      console.warn('⚠️  RabbitMQ no disponible para calification');
    }
    
    res.json({ success: true, message: 'Evento calification recibido', data: event });
  } catch (error) {
    console.error('❌ Error enviando evento calification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== Fin Eventos =====

// Iniciar servidor con RabbitMQ
async function startServer() {
  // Intentar conectar a RabbitMQ (opcional)
  await setupRabbitMQ().catch(err => {
    console.warn('⚠️ Continuando sin RabbitMQ...');
  });
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
