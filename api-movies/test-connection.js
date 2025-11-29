const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.MONGODB_URI) {
  require('dotenv').config({ path: path.join(__dirname, '.env.example') });
}

const { MongoClient } = require('mongodb');

async function testConnection() {
  console.log('🔍 Probando conexión a MongoDB...');
  console.log(`📍 URI: ${process.env.MONGODB_URI}`);
  
  const mongoClient = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await mongoClient.connect();
    console.log('✅ Conectado exitosamente a MongoDB');
    
    // Listar todas las bases de datos
    const admin = mongoClient.db().admin();
    const dbs = await admin.listDatabases();
    console.log('\n📚 Bases de datos disponibles:');
    dbs.databases.forEach(db => console.log(`  - ${db.name}`));
    
    // Conectar a la BD "peliculas"
    const db = mongoClient.db('peliculas');
    console.log(`\n📍 Conectando a BD: peliculas`);
    
    const collections = await db.listCollections().toArray();
    console.log('📚 Colecciones en "películas":');
    if (collections.length === 0) {
      console.log('  (vacío)');
    } else {
      collections.forEach(col => console.log(`  - ${col.name}`));
    }
    
    // Verificar colección movies
    const moviesCollection = db.collection('movies');
    const count = await moviesCollection.countDocuments();
    console.log(`\n🎬 Documentos en 'movies': ${count}`);
    
    if (count > 0) {
      const firstMovie = await moviesCollection.findOne();
      if (firstMovie) {
        console.log('\n📄 Primer documento:');
        console.log(JSON.stringify(firstMovie, null, 2).substring(0, 500) + '...');
      }
    }
    
    await mongoClient.close();
    console.log('\n✅ Prueba completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testConnection();
