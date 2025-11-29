const express = require('express');
const router = express.Router();
const movieService = require('../services/movieService');

// Rutas específicas primero (para evitar conflictos con :id)

// Obtener géneros disponibles
router.get('/genres/available/list', async (req, res) => {
  try {
    const result = await movieService.getAvailableGenres();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Obtener películas por género
router.get('/genre/:genre', async (req, res) => {
  try {
    const result = await movieService.getMoviesByGenre(req.params.genre);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Obtener películas populares
router.get('/popular/:limit?', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10;
    const result = await movieService.getPopularMovies(limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Buscar películas por título
router.get('/search/title/:title', async (req, res) => {
  try {
    const result = await movieService.searchMoviesByTitle(req.params.title);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Rutas generales

// Obtener todas las películas con filtros opcionales
router.get('/', async (req, res) => {
  try {
    const filters = {
      title: req.query.title,
      genre: req.query.genre,
      year: req.query.year,
      minRating: req.query.minRating,
      page: req.query.page || 1,
      limit: req.query.limit || 10,
    };
    
    const result = await movieService.getAllMovies(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Obtener película por ID (última ruta, más general)
router.get('/:id', async (req, res) => {
  try {
    const result = await movieService.getMovieById(req.params.id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
