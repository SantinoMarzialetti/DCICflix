const amqp = require('amqplib');

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
    console.log('✓ Colas: clicks_queue, califications_queue, plays_queue');
    return channel;
  } catch (error) {
    console.error('✗ Error configurando RabbitMQ:', error);
    throw error;
  }
}

function getChannel() {
  if (!channel) {
    throw new Error('Canal de RabbitMQ no inicializado');
  }
  return channel;
}

async function publishMessage(routingKey, message) {
  try {
    const ch = getChannel();
    const messageBuffer = Buffer.from(JSON.stringify(message));
    ch.publish(EXCHANGE_NAME, routingKey, messageBuffer, { persistent: true });
    console.log(`✓ Evento publicado [${routingKey}]:`, message);
  } catch (error) {
    console.error('✗ Error publicando evento:', error);
    throw error;
  }
}

async function consumeMessages(queueName, callback) {
  try {
    const ch = getChannel();
    await ch.consume(queueName, async (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        console.log(`✓ Evento recibido de ${queueName}:`, content);
        
        try {
          await callback(content);
          ch.ack(msg);
        } catch (error) {
          console.error('✗ Error procesando evento:', error);
          ch.nack(msg, false, true); // Requeue el mensaje
        }
      }
    }, { noAck: false });
  } catch (error) {
    console.error('✗ Error consumiendo eventos:', error);
    throw error;
  }
}

module.exports = {
  setupRabbitMQ,
  getChannel,
  publishMessage,
  consumeMessages,
  EXCHANGE_NAME,
  CLICKS_QUEUE,
  CALIFICATIONS_QUEUE,
  PLAYS_QUEUE
};
