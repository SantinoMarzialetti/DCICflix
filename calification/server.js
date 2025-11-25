const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Si no existe .env, intentar usar .env.example
if (!process.env.MONGODB_URI) {
  require('dotenv').config({ path: path.join(__dirname, '.env.example') });
}

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { setupRabbitMQ } = require('./rabbitmq/connection');
const calificationRoutes = require('./routes/calificationRoutes');

const app = express();
const PORT = process.env.PORT || 3003;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/events', calificationRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ status: 'Events Hub service is running' });
});

// Conectar a MongoDB y RabbitMQ
async function startServer() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Conectado a MongoDB');

    // Conectar a RabbitMQ
    await setupRabbitMQ();
    console.log('✓ Conectado a RabbitMQ');

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`✓ Events Hub ejecutándose en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('✗ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
