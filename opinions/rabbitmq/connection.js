const amqp = require('amqplib');
const axios = require('axios');
const Click = require('../models/Click');
const Play = require('../models/Play');

let channel = null;
let connection = null;

const EXCHANGE_NAME = process.env.RABBITMQ_EXCHANGE || 'events_exchange';
const CLICKS_QUEUE = process.env.RABBITMQ_QUEUE_CLICKS || 'clicks_queue';
const CALIFICATIONS_QUEUE = process.env.RABBITMQ_QUEUE_CALIFICATIONS || 'califications_queue';
const PLAYS_QUEUE = process.env.RABBITMQ_QUEUE_PLAYS || 'plays_queue';

async function setupRabbitMQ() {
  try {
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
          console.log('📥 Click recibido:', data);

          const click = new Click(data);
          await click.save();
          console.log('✓ Click guardado en BD');

          channel.ack(msg);
        } catch (error) {
          console.error('✗ Error procesando click:', error);
          channel.nack(msg, false, true); // Reencolar si hay error
        }
      }
    });

    // Consumir calificaciones
    await channel.consume(CALIFICATIONS_QUEUE, async (msg) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          console.log('📥 Calificación recibida:', data);

          // Hacer POST al endpoint local para actualizar rating en Atlas
          // Usar "opiniones" (nombre del servicio en Docker) en lugar de localhost
          try {
            const response = await axios.post('http://opiniones:3004/api/update-rating', {
              movieId: data.movieId,
              rating: data.rating
            });
            
            if (response.data.success) {
              console.log(`✓ Rating actualizado - ${response.data.movie} (${response.data.newRating})`);
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
          console.log('📥 Play recibido:', data);

          const play = new Play(data);
          await play.save();
          console.log('✓ Play guardado en BD');

          channel.ack(msg);
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
