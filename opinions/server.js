const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { setupRabbitMQ, consumeMessages } = require('./rabbitmq/connection');

const app = express();
const PORT = process.env.PORT || 3004;

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ status: 'Opiniones service is running' });
});

// Conectar a MongoDB y RabbitMQ
async function startServer() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Conectado a MongoDB');

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
