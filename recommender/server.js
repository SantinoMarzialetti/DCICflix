require('dotenv').config();

const express = require('express');
const cors = require('cors');
const RecommendationService = require('./services/recommendationService');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Recommender service is running' });
});

// Recomendaciones generales
app.get('/api/recommendations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const recommendations = await RecommendationService.getRecommendations(limit);
    const stats = RecommendationService.getInteractionStats();
    
    res.json({
      success: true,
      recommendations,
      stats,
      count: recommendations.length
    });
  } catch (error) {
    console.error('✗ Error obteniendo recomendaciones:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Recomendaciones por género
app.get('/api/recommendations/genre', async (req, res) => {
  try {
    const genres = req.query.genres?.split(',').map(g => g.trim()) || [];
    const limit = parseInt(req.query.limit) || 5;
    
    if (genres.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debes especificar géneros (ej: ?genres=Action,Comedy)'
      });
    }

    // Usa getRecommendations con filtro de género
    const allRecs = await RecommendationService.getRecommendations(limit * 2);
    const recommendations = allRecs.filter(m => 
      m.genre && m.genre.some(g => genres.includes(g))
    ).slice(0, limit);
    
    res.json({
      success: true,
      genres,
      recommendations,
      count: recommendations.length
    });
  } catch (error) {
    console.error('✗ Error obteniendo recomendaciones por género:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Top películas por clicks
app.get('/api/recommendations/top-clicks', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topClicks = RecommendationService.getTopByMetric('clicks', limit);
    
    res.json({
      success: true,
      metric: 'clicks',
      recommendations: topClicks,
      count: topClicks.length
    });
  } catch (error) {
    console.error('✗ Error obteniendo top clicks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Top películas por plays
app.get('/api/recommendations/top-plays', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topPlays = RecommendationService.getTopByMetric('plays', limit);
    
    res.json({
      success: true,
      metric: 'plays',
      recommendations: topPlays,
      count: topPlays.length
    });
  } catch (error) {
    console.error('✗ Error obteniendo top plays:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Top películas por ratings
app.get('/api/recommendations/top-ratings', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topRatings = RecommendationService.getTopByMetric('ratings', limit);
    
    res.json({
      success: true,
      metric: 'ratings',
      recommendations: topRatings,
      count: topRatings.length
    });
  } catch (error) {
    console.error('✗ Error obteniendo top ratings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Análisis general
app.get('/api/analytics', (req, res) => {
  try {
    const analytics = RecommendationService.getAnalytics();
    const stats = RecommendationService.getInteractionStats();
    
    res.json({
      success: true,
      analytics,
      stats
    });
  } catch (error) {
    console.error('✗ Error obteniendo analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`🎬 Recommender service running on port ${PORT}`);
  console.log(`📊 Endpoints disponibles:`);
  console.log(`   GET /api/health`);
  console.log(`   GET /api/recommendations?limit=10`);
  console.log(`   GET /api/recommendations/genre?genres=Action,Comedy&limit=5`);
  console.log(`   GET /api/recommendations/top-clicks?limit=10`);
  console.log(`   GET /api/recommendations/top-plays?limit=10`);
  console.log(`   GET /api/recommendations/top-ratings?limit=10`);
  console.log(`   GET /api/analytics`);
});

module.exports = app;
