const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL;

const tmdbHeaders = {
  Authorization: `Bearer ${TMDB_API_KEY}`,
  'Content-Type': 'application/json'
};

// API Routes
app.get('/api/movies/popular', async (req, res) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
      headers: tmdbHeaders,
      params: { language: 'es-ES', page: 1 }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching popular movies:', error.message);
    res.status(500).json({ error: 'Error fetching popular movies' });
  }
});

app.get('/api/movies/top-rated', async (req, res) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/top_rated`, {
      headers: tmdbHeaders,
      params: { language: 'es-ES', page: 1 }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching top rated movies:', error.message);
    res.status(500).json({ error: 'Error fetching top rated movies' });
  }
});

app.get('/api/movies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${TMDB_BASE_URL}/movie/${id}`, {
      headers: tmdbHeaders,
      params: { language: 'es-ES' }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching movie details:', error.message);
    res.status(500).json({ error: 'Error fetching movie details' });
  }
});

app.get('/api/movies/:id/images', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${TMDB_BASE_URL}/movie/${id}/images`, {
      headers: tmdbHeaders
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching movie images:', error.message);
    res.status(500).json({ error: 'Error fetching movie images' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DCICflix API is running' });
});

// Serve static files from React build (production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
