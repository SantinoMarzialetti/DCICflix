const fs = require('fs');
const path = require('path');

const CLICKS_DIR = process.env.CLICKS_DIR || '/data/clicks';
const PLAYS_DIR = process.env.PLAYS_DIR || '/data/plays';
const RATINGS_DIR = process.env.RATINGS_DIR || '/data/ratings';
const SERVER_DATA_DIR = process.env.SERVER_DATA_DIR || '/app/data';
const WEIGHTS_FILE = path.join(SERVER_DATA_DIR, 'movie_weights.json');
const PLAYED_MOVIES_FILE = path.join(SERVER_DATA_DIR, 'played_movies.json');

// Umbrales de fase
const THRESHOLD_PERSONALIZED_START = 20;  // A partir de 20 interacciones, 5 películas personalizadas
const THRESHOLD_PERSONALIZED_FULL = 30;   // A partir de 30 interacciones, 8 películas personalizadas

class RecommendationService {
  // Leer clicks del volumen
  getClicks() {
    try {
      const filePath = path.join(CLICKS_DIR, 'clicks.json');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) || [];
      }
      return [];
    } catch (error) {
      console.error('✗ Error leyendo clicks:', error.message);
      return [];
    }
  }

  // Leer plays del volumen
  getPlays() {
    try {
      const filePath = path.join(PLAYS_DIR, 'plays.json');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) || [];
      }
      return [];
    } catch (error) {
      console.error('✗ Error leyendo plays:', error.message);
      return [];
    }
  }

  // Leer ratings del volumen
  getRatings() {
    try {
      const filePath = path.join(RATINGS_DIR, 'ratings.json');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) || [];
      }
      return [];
    } catch (error) {
      console.error('✗ Error leyendo ratings:', error.message);
      return [];
    }
  }

  // Cargar ponderaciones de películas relacionadas
  loadMovieWeights() {
    try {
      if (fs.existsSync(WEIGHTS_FILE)) {
        return JSON.parse(fs.readFileSync(WEIGHTS_FILE, 'utf-8'));
      }
    } catch (error) {
      console.error('✗ Error cargando ponderaciones:', error.message);
    }
    return {};
  }

  // Obtener películas reproducidas
  getPlayedMovies() {
    try {
      if (fs.existsSync(PLAYED_MOVIES_FILE)) {
        return new Set(JSON.parse(fs.readFileSync(PLAYED_MOVIES_FILE, 'utf-8')));
      }
    } catch (error) {
      console.error('✗ Error cargando películas reproducidas:', error.message);
    }
    return new Set();
  }

  // Obtener todas las películas desde la API
  async getAllMovies() {
    try {
      const response = await fetch('http://api-movies:3007/api/movies');
      if (response.ok) {
        const data = await response.json();
        return data.data || data.movies || [];
      }
    } catch (error) {
      console.warn('⚠️  No se pudo obtener películas desde API:', error.message);
    }
    return [];
  }

  // Contar interacciones totales
  getInteractionStats() {
    const clicks = this.getClicks();
    const plays = this.getPlays();
    const ratings = this.getRatings();
    
    return {
      clicks: clicks.length,
      plays: plays.length,
      ratings: ratings.length,
      total: clicks.length + plays.length + ratings.length
    };
  }

  // FASE 1: GENÉRICA - Películas con buena calificación, variadas por género
  async getGenericRecommendations(limit = 10) {
    console.log('📊 FASE 1: Recomendaciones GENÉRICAS');
    
    try {
      const allMovies = await this.getAllMovies();
      const playedMovies = this.getPlayedMovies();
      
      if (allMovies.length === 0) {
        console.log('⚠️  No hay películas disponibles');
        return [];
      }

      // Filtrar películas reproducidas
      const availableMovies = allMovies.filter(m => !playedMovies.has(m._id));
      
      // Agrupar por género y tomar las mejores de cada uno
      const genreGroups = {};
      
      availableMovies.forEach(movie => {
        const genres = movie.genre || ['Sin género'];
        genres.forEach(genre => {
          if (!genreGroups[genre]) {
            genreGroups[genre] = [];
          }
          genreGroups[genre].push(movie);
        });
      });

      // Seleccionar mejores películas por género
      const recommendations = [];
      const genreNames = Object.keys(genreGroups);
      
      for (let i = 0; i < limit && i < genreNames.length; i++) {
        const genre = genreNames[i];
        // Ordenar por rating si existe, si no por nombre
        const sorted = genreGroups[genre].sort((a, b) => {
          const ratingDiff = (b.rating || 0) - (a.rating || 0);
          if (ratingDiff !== 0) return ratingDiff;
          return (a.title || a.movieName).localeCompare(b.title || b.movieName);
        });
        
        recommendations.push({
          movieId: sorted[0]._id,
          name: sorted[0].title || sorted[0].movieName,
          genre: sorted[0].genre,
          director: sorted[0].director,
          rating: sorted[0].rating || 0,
          reason: `Top en género: ${genre}`,
          phase: 'generic'
        });
      }

      // Si no hay suficientes, completar con las mejores globales
      if (recommendations.length < limit) {
        const used = new Set(recommendations.map(r => r.movieId));
        const best = availableMovies
          .filter(m => !used.has(m._id))
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, limit - recommendations.length)
          .map(m => ({
            movieId: m._id,
            name: m.title || m.movieName,
            genre: m.genre,
            director: m.director,
            rating: m.rating || 0,
            reason: 'Película destacada',
            phase: 'generic'
          }));
        
        recommendations.push(...best);
      }

      return recommendations.slice(0, limit);
    } catch (error) {
      console.error('❌ Error en recomendaciones genéricas:', error);
      return [];
    }
  }

  // FASE 2: PERSONALIZADA - Mezcla de genérica + películas ponderadas
  async getPersonalizedRecommendations(limit = 10, personalizedCount) {
    console.log(`🎯 FASE 2: Recomendaciones PERSONALIZADAS (${personalizedCount} películas ponderadas)`);
    
    try {
      const allMovies = await this.getAllMovies();
      const playedMovies = this.getPlayedMovies();
      const weights = this.loadMovieWeights();
      
      if (allMovies.length === 0) {
        return [];
      }

      // Filtrar películas reproducidas
      const availableMovies = allMovies.filter(m => !playedMovies.has(m._id));
      
      // Películas ponderadas ordenadas por peso (todas, sin filtro de > 1.0)
      const weightedMovies = availableMovies
        .map(m => ({
          movieId: m._id,
          name: m.title || m.movieName,
          genre: m.genre,
          director: m.director,
          rating: m.rating || 0,
          weight: weights[m._id] ? weights[m._id].totalWeight : 0,
          reason: weights[m._id] ? `Personalizada (peso: ${weights[m._id].totalWeight.toFixed(2)})` : `Sugerida`,
          phase: 'personalized'
        }))
        .sort((a, b) => {
          // Primero por peso (descendente)
          if (b.weight !== a.weight) return b.weight - a.weight;
          // Si hay empate, randomizar para variedad
          return Math.random() - 0.5;
        })
        .slice(0, personalizedCount);

      // Películas genéricas para completar
      const genericCount = limit - weightedMovies.length;
      const usedIds = new Set(weightedMovies.map(m => m.movieId));
      
      let genericMovies = [];
      if (genericCount > 0) {
        const genreGroups = {};
        
        availableMovies
          .filter(m => !usedIds.has(m._id))
          .forEach(movie => {
            const genres = movie.genre || ['Sin género'];
            genres.forEach(genre => {
              if (!genreGroups[genre]) {
                genreGroups[genre] = [];
              }
              genreGroups[genre].push(movie);
            });
          });

        const genreNames = Object.keys(genreGroups).sort(() => Math.random() - 0.5); // Randomizar géneros también
        
        for (let i = 0; i < genericCount && i < genreNames.length; i++) {
          const genre = genreNames[i];
          const sorted = genreGroups[genre].sort((a, b) => {
            const ratingDiff = (b.rating || 0) - (a.rating || 0);
            if (ratingDiff !== 0) return ratingDiff;
            return (a.title || a.movieName).localeCompare(b.title || b.movieName);
          });
          
          genericMovies.push({
            movieId: sorted[0]._id,
            name: sorted[0].title || sorted[0].movieName,
            genre: sorted[0].genre,
            director: sorted[0].director,
            rating: sorted[0].rating || 0,
            reason: `Top en género: ${genre}`,
            phase: 'mixed'
          });
        }
      }

      return [...weightedMovies, ...genericMovies];
    } catch (error) {
      console.error('❌ Error en recomendaciones personalizadas:', error);
      return [];
    }
  }

  // Orquestador principal
  async getRecommendations(limit = 10) {
    const stats = this.getInteractionStats();
    
    console.log(`\n=== RECOMENDADOR ===`);
    console.log(`📊 Interacciones totales: ${stats.total}`);
    console.log(`   - Clicks: ${stats.clicks}`);
    console.log(`   - Plays: ${stats.plays}`);
    console.log(`   - Ratings: ${stats.ratings}`);

    // Determinar fase y cantidad de películas personalizadas
    if (stats.total < THRESHOLD_PERSONALIZED_START) {
      console.log(`⏳ Modo GENÉRICO (${stats.total} < ${THRESHOLD_PERSONALIZED_START})`);
      console.log(`   Necesitas ${THRESHOLD_PERSONALIZED_START - stats.total} interacciones más para personalización`);
      return this.getGenericRecommendations(limit);
    } else if (stats.total < THRESHOLD_PERSONALIZED_FULL) {
      // 20-29 interacciones: 5 películas personalizadas
      const personalizedCount = 5;
      console.log(`📈 Modo MIXTO: ${personalizedCount} películas personalizadas + ${limit - personalizedCount} genéricas`);
      console.log(`   ${THRESHOLD_PERSONALIZED_FULL - stats.total} interacciones más para personalización completa`);
      return this.getPersonalizedRecommendations(limit, personalizedCount);
    } else {
      // 30+ interacciones: 8 películas personalizadas
      const personalizedCount = 8;
      console.log(`🔥 Modo PERSONALIZADO COMPLETO: ${personalizedCount} películas personalizadas + ${limit - personalizedCount} genéricas`);
      return this.getPersonalizedRecommendations(limit, personalizedCount);
    }
  }

  // Analytics general
  getAnalytics() {
    const clicks = this.getClicks();
    const plays = this.getPlays();
    const ratings = this.getRatings();

    return {
      totalClicks: clicks.length,
      totalPlays: plays.length,
      totalRatings: ratings.length,
      uniqueMoviesClicked: new Set(clicks.map(c => c.movieId)).size,
      uniqueMoviesPlayed: new Set(plays.map(p => p.movieId)).size,
      uniqueMoviesRated: new Set(ratings.map(r => r.movieId)).size,
      averageRating: ratings.length > 0 
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(2)
        : 0,
      topGenres: this.getTopGenres(clicks, plays, ratings),
      topDirectors: this.getTopDirectors(clicks, plays, ratings)
    };
  }

  // Géneros más populares
  getTopGenres(clicks, plays, ratings) {
    const genreCounts = {};

    [...clicks, ...plays, ...ratings].forEach(item => {
      if (item.genre && Array.isArray(item.genre)) {
        item.genre.forEach(genre => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      }
    });

    return Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // Directores más populares
  getTopDirectors(clicks, plays, ratings) {
    const directorCounts = {};

    [...clicks, ...plays, ...ratings].forEach(item => {
      if (item.director) {
        directorCounts[item.director] = (directorCounts[item.director] || 0) + 1;
      }
    });

    return Object.entries(directorCounts)
      .map(([director, count]) => ({ director, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

module.exports = new RecommendationService();
