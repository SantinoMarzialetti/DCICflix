const { getDB } = require('../db/connection');
const fs = require('fs');
const path = require('path');

async function importMovies() {
  try {
    const db = getDB();
    const collection = db.collection('movies');

    // Leer el archivo JSON
    const filePath = path.join(__dirname, 'peliculas.movies.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const moviesData = JSON.parse(fileContent);

    console.log(`📥 Leyendo ${moviesData.length} películas del archivo...`);

    // Mapear los datos al formato esperado
    const mappedMovies = moviesData.map(movie => ({
      _id: movie._id,
      title: movie.title,
      plot: movie.plot || movie.fullplot || '',
      genres: movie.genres || [],
      runtime: movie.runtime || 0,
      cast: movie.cast || [],
      poster: movie.poster || '',
      year: movie.year || null,
      rated: movie.rated || 'N/A',
      directors: movie.directors || [],
      countries: movie.countries || [],
      imdb: movie.imdb || { rating: 0, votes: 0, id: 0 },
      rating: movie.imdb?.rating || 0,
      languages: movie.languages || [],
      released: movie.released || null,
      type: movie.type || 'movie',
      tomatoes: movie.tomatoes || {},
      num_mflix_comments: movie.num_mflix_comments || 0,
      lastupdated: movie.lastupdated || new Date(),
    }));

    // Limpiar la colección
    await collection.deleteMany({});
    console.log('🗑️ Colección limpiada');

    // Insertar los datos
    const result = await collection.insertMany(mappedMovies);
    console.log(`✅ ${result.insertedCount} películas insertadas exitosamente`);

    // Crear índices para mejores búsquedas
    await collection.createIndex({ title: 'text', plot: 'text' });
    await collection.createIndex({ genres: 1 });
    await collection.createIndex({ year: 1 });
    await collection.createIndex({ rating: -1 });
    console.log('📑 Índices creados');

  } catch (error) {
    console.error('❌ Error al importar películas:', error.message);
  }
}

module.exports = { importMovies };
