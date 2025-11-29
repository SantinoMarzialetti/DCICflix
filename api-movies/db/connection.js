const { MongoClient } = require('mongodb');

let mongoClient = null;
let db = null;

async function connectDB() {
  if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected()) {
    return db;
  }

  try {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    // Extraer nombre de BD de la URI o usar "peliculas" como default
    const dbName = 'peliculas';
    db = mongoClient.db(dbName);
    console.log('✓ Conexión a MongoDB establecida');
    return db;
  } catch (error) {
    console.error('✗ Error conectando a MongoDB:', error);
    throw error;
  }
}

function getDB() {
  if (!db) {
    throw new Error('Base de datos no conectada. Llame a connectDB() primero.');
  }
  return db;
}

async function closeDB() {
  if (mongoClient) {
    await mongoClient.close();
    console.log('✓ Conexión a MongoDB cerrada');
  }
}

module.exports = {
  connectDB,
  getDB,
  closeDB,
};
