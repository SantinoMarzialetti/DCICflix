const amqp = require('amqplib');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Click = require('../models/Click');
const Play = require('../models/Play');

let channel = null;
let connection = null;

const EXCHANGE_NAME = process.env.RABBITMQ_EXCHANGE || 'events_exchange';
const CLICKS_QUEUE = process.env.RABBITMQ_QUEUE_CLICKS || 'clicks_queue';
const CALIFICATIONS_QUEUE = process.env.RABBITMQ_QUEUE_CALIFICATIONS || 'califications_queue';
const PLAYS_QUEUE = process.env.RABBITMQ_QUEUE_PLAYS || 'plays_queue';

// Directorios separados para cada tipo de dato
const CLICKS_DIR = process.env.CLICKS_DIR || '/data/clicks';
const PLAYS_DIR = process.env.PLAYS_DIR || '/data/plays';
const RATINGS_DIR = process.env.RATINGS_DIR || '/data/ratings';

// Crear directorios si no existen
function ensureDirectories() {
  [CLICKS_DIR, PLAYS_DIR, RATINGS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✓ Directorio creado: ${dir}`);
    }
  });
}

// Guardar clicks en su directorio
function saveClick(data) {
  try {
    const filePath = path.join(CLICKS_DIR, 'clicks.json');
    let clicks = [];

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      clicks = JSON.parse(content);
    }

    clicks.push({
      ...data,
      savedAt: new Date().toISOString()
    });

    fs.writeFileSync(filePath, JSON.stringify(clicks, null, 2), 'utf-8');
    console.log('✓ Click guardado en volumen');
    return true;
  } catch (error) {
    console.error('✗ Error guardando click:', error);
    return false;
  }
}

// Guardar plays en su directorio
function savePlay(data) {
  try {
    const filePath = path.join(PLAYS_DIR, 'plays.json');
    let plays = [];

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      plays = JSON.parse(content);
    }

    plays.push({
      ...data,
      savedAt: new Date().toISOString()
    });

    fs.writeFileSync(filePath, JSON.stringify(plays, null, 2), 'utf-8');
    console.log('✓ Play guardado en volumen');
    return true;
  } catch (error) {
    console.error('✗ Error guardando play:', error);
    return false;
  }
}

// Guardar ratings en su directorio
function saveRating(data) {
  try {
    const filePath = path.join(RATINGS_DIR, 'ratings.json');
    let ratings = [];

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      ratings = JSON.parse(content);
    }

    ratings.push({
      ...data,
      savedAt: new Date().toISOString()
    });

    fs.writeFileSync(filePath, JSON.stringify(ratings, null, 2), 'utf-8');
    console.log('✓ Rating guardado en volumen');
    return true;
  } catch (error) {
    console.error('✗ Error guardando rating:', error);
    return false;
  }
}

async function setupRabbitMQ() {
  try {
    // Crear directorios de datos
    ensureDirectories();

    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();

    // Crear exchange
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    // Crear colas
    await channel.assertQueue(CLICKS_QUEUE, { durable: true });
    await channel.assertQueue(CALIFICATIONS_QUEUE, { durable: true });
    await channel.assertQueue(PLAYS_QUEUE, { durable: true });

    // Bind de colas al exchange
    await channel.bindQueue(CLICKS_QUEUE, EXCHANGE_NAME, 'movie.clicked');
    await channel.bindQueue(CALIFICATIONS_QUEUE, EXCHANGE_NAME, 'movie.rated');
    await channel.bindQueue(PLAYS_QUEUE, EXCHANGE_NAME, 'movie.played');

    console.log('✓ RabbitMQ configurado correctamente');
  } catch (error) {
    console.error('✗ Error configurando RabbitMQ:', error);
    throw error;
  }
}

async function consumeMessages() {
  try {
    // Consumir clicks
    await channel.consume(CLICKS_QUEUE, async (msg) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          console.log('📍 Click recibido:', data);

          // Guardar en volumen
          if (saveClick(data)) {
            console.log('✓ Click almacenado');
            channel.ack(msg);
          } else {
            console.error('✗ Error guardando click');
            channel.nack(msg, false, true);
          }
        } catch (error) {
          console.error('✗ Error procesando click:', error);
          channel.nack(msg, false, true);
        }
      }
    });

    // Consumir calificaciones
    await channel.consume(CALIFICATIONS_QUEUE, async (msg) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          console.log('📥 Calificación recibida:', data);

          // Guardar en volumen
          const savedToVolume = saveRating(data);
          console.log(savedToVolume ? '✓ Guardada en volumen' : '⚠️ Error al guardar en volumen');

          // Hacer POST al endpoint local para actualizar rating en Atlas
          // Usar "opiniones" (nombre del servicio en Docker) en lugar de localhost
          try {
            const response = await axios.post('http://opiniones:3004/api/update-rating', {
              movieId: data.movieId,
              rating: data.rating
            });
            
            if (response.data.success) {
              console.log(`✓ Rating actualizado en BD - ${response.data.movie} (${response.data.newRating})`);
              console.log(`✓ Calificación almacenada en volumen y BD`);
              channel.ack(msg);
            } else {
              console.error('✗ Error en respuesta de update-rating:', response.data.error);
              channel.nack(msg, false, true);
            }
          } catch (apiError) {
            console.error('✗ Error llamando a /api/update-rating:', apiError.message);
            channel.nack(msg, false, true);
          }
        } catch (error) {
          console.error('✗ Error procesando calificación:', error);
          channel.nack(msg, false, true);
        }
      }
    });

    // Consumir plays
    await channel.consume(PLAYS_QUEUE, async (msg) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          console.log('▶️ Play recibido:', data);

          // Guardar en volumen
          if (savePlay(data)) {
            console.log('✓ Play almacenado');
            channel.ack(msg);
          } else {
            console.error('✗ Error guardando play');
            channel.nack(msg, false, true);
          }
        } catch (error) {
          console.error('✗ Error procesando play:', error);
          channel.nack(msg, false, true);
        }
      }
    });

    console.log('✓ Consumidores iniciados para las 3 colas');
  } catch (error) {
    console.error('✗ Error iniciando consumidores:', error);
    throw error;
  }
}

module.exports = {
  setupRabbitMQ,
  consumeMessages,
  getChannel: () => channel
};
