const { getDB } = require('../db/connection');
const { ObjectId } = require('mongodb');

// Obtener todas las películas
async function getAllMovies(filters = {}) {
  try {
    const db = getDB();
    const collection = db.collection('movies');
    
    // Construir query con filtros
    const query = {
      poster: { $exists: true, $ne: null, $ne: '' }
    };
    
    if (filters.title) {
      query.title = { $regex: filters.title, $options: 'i' };
    }
    if (filters.genre) {
      query.genres = { $in: [new RegExp(filters.genre, 'i')] };
    }
    if (filters.year) {
      query.year = parseInt(filters.year);
    }
    if (filters.minRating) {
      query['imdb.rating'] = { $gte: parseFloat(filters.minRating) };
    }
    
    const skip = (parseInt(filters.page) - 1) * (parseInt(filters.limit) || 10) || 0;
    const limit = parseInt(filters.limit) || 10;
    
    const movies = await collection
      .find(query)
      .project({
        _id: 1,
        title: 1,
        poster: 1,
        plot: 1,
        fullplot: 1,
        genres: 1,
        year: 1,
        'imdb.rating': 1,
        'imdb.votes': 1,
        cast: 1,
        directors: 1,
        runtime: 1
      })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    const total = await collection.countDocuments(query);
    
    return {
      success: true,
      data: movies,
      total,
      page: parseInt(filters.page) || 1,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    throw new Error(`Error al obtener películas: ${error.message}`);
  }
}

// Obtener película por ID
async function getMovieById(id) {
  try {
    const db = getDB();
    const collection = db.collection('movies');
    
    // Intentar como ObjectId primero
    let movie;
    try {
      movie = await collection.findOne({
        _id: new ObjectId(id),
      });
    } catch (e) {
      // Si falla, buscar como string
      movie = null;
    }
    
    if (!movie) {
      return {
        success: false,
        message: 'Película no encontrada',
      };
    }
    
    return {
      success: true,
      data: {
        _id: movie._id,
        title: movie.title,
        poster: movie.poster,
        plot: movie.plot,
        fullplot: movie.fullplot,
        genres: movie.genres,
        year: movie.year,
        imdb: movie.imdb,
        cast: movie.cast,
        directors: movie.directors,
        runtime: movie.runtime,
        countries: movie.countries
      },
    };
  } catch (error) {
    throw new Error(`Error al obtener película: ${error.message}`);
  }
}

// Buscar películas por título
async function searchMoviesByTitle(title) {
  try {
    const db = getDB();
    const collection = db.collection('movies');
    
    const movies = await collection
      .find({
        title: { $regex: title, $options: 'i' },
      })
      .limit(20)
      .toArray();
    
    return {
      success: true,
      data: movies,
      count: movies.length,
    };
  } catch (error) {
    throw new Error(`Error al buscar películas: ${error.message}`);
  }
}

// Obtener películas por género
async function getMoviesByGenre(genre) {
  try {
    const db = getDB();
    const collection = db.collection('movies');
    
    const movies = await collection
      .find({
        genres: { $in: [new RegExp(genre, 'i')] },
      })
      .limit(100)
      .toArray();
    
    return {
      success: true,
      data: movies,
      count: movies.length,
    };
  } catch (error) {
    throw new Error(`Error al obtener películas por género: ${error.message}`);
  }
}

// Obtener películas populares (por rating de IMDB)
async function getPopularMovies(limit = 10) {
  try {
    const db = getDB();
    const collection = db.collection('movies');
    
    const movies = await collection
      .find({
        poster: { $exists: true, $ne: null, $ne: '' },
        'imdb.rating': { $exists: true, $gt: 0 },
        'imdb.votes': { $exists: true, $gt: 0 }
      })
      .project({
        _id: 1,
        title: 1,
        poster: 1,
        plot: 1,
        fullplot: 1,
        genres: 1,
        year: 1,
        'imdb.rating': 1,
        'imdb.votes': 1
      })
      .sort({ 'imdb.rating': -1, 'imdb.votes': -1 })
      .limit(parseInt(limit))
      .toArray();
    
    return {
      success: true,
      data: movies,
      count: movies.length,
    };
  } catch (error) {
    throw new Error(`Error al obtener películas populares: ${error.message}`);
  }
}

// Obtener géneros disponibles
async function getAvailableGenres() {
  try {
    const db = getDB();
    const collection = db.collection('movies');
    
    const genres = await collection.distinct('genres');
    
    return {
      success: true,
      data: genres.filter(g => g !== null && g !== undefined).sort(),
      count: genres.length,
    };
  } catch (error) {
    throw new Error(`Error al obtener géneros: ${error.message}`);
  }
}

module.exports = {
  getAllMovies,
  getMovieById,
  searchMoviesByTitle,
  getMoviesByGenre,
  getPopularMovies,
  getAvailableGenres,
};
