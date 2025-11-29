const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Si no existe .env, intentar usar .env.example
if (!process.env.MONGODB_URI) {
  require('dotenv').config({ path: path.join(__dirname, '.env.example') });
}

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db/connection');
const movieRoutes = require('./routes/movieRoutes');

const app = express();
const PORT = process.env.PORT || 3004;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/movies', movieRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ status: 'Movies API service is running' });
});

// Iniciar servidor
async function startServer() {
  try {
    // Conectar a MongoDB
    await connectDB();
    console.log('✓ Conectado a MongoDB Atlas');

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`✓ Movies API ejecutándose en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('✗ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
