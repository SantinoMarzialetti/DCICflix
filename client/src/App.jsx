import { useState, useEffect, useRef } from 'react';
import './App.css';
import placeholderImage from './assets/placeholder-poster.svg';

const API_URL = 'http://localhost:3000/api';
const RANDOM_API_URL = 'http://localhost:3001/api';
const MOVIES_API_URL = 'http://localhost:3004/api/movies';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const EVENTS_HUB_URL = 'http://localhost:3002/api';
const PLACEHOLDER_POSTER = placeholderImage;

function App() {
  const [featuredMovie, setFeaturedMovie] = useState(null);
  const [popularMovies, setPopularMovies] = useState([]);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [randomMovies, setRandomMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingMovie, setRatingMovie] = useState(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [movieDetails, setMovieDetails] = useState({});
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      
      // Fetch popular movies from new API
      const popularRes = await fetch(`${MOVIES_API_URL}?page=1&limit=20`);
      const popularData = await popularRes.json();
      const moviesFromAPI = (popularData.data || []).map(movie => ({
        id: movie._id,
        title: movie.title,
        poster_path: movie.poster || '',
        backdrop_path: movie.poster || '',
        vote_average: movie.imdb?.rating || 0,
        overview: movie.plot || movie.fullplot || '',
        release_date: movie.released ? new Date(movie.released).toISOString().split('T')[0] : null,
        original_language: 'en',
        poster: movie.poster || ''
      }));
      setPopularMovies(moviesFromAPI);
      
      // Fetch top rated movies
      const topRatedRes = await fetch(`${API_URL}/movies/top-rated`);
      const topRatedData = await topRatedRes.json();
      setTopRatedMovies(topRatedData.results || []);
      
      // Fetch random movies from microservice
      const randomRes = await fetch(`${RANDOM_API_URL}/random-movies?count=20`);
      const randomData = await randomRes.json();
      setRandomMovies(randomData.movies || []);
      
      // Set random featured movie from API movies
      if (moviesFromAPI.length > 0) {
        const randomMovie = moviesFromAPI[Math.floor(Math.random() * moviesFromAPI.length)];
        setFeaturedMovie(randomMovie);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching movies:', error);
      setLoading(false);
    }
  };

  const fetchMovieDetails = async (movieId) => {
    try {
      const response = await fetch(`${API_URL}/movies/${movieId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching movie details:', error);
      return null;
    }
  };

  const sendEventToHub = async (eventType, movieData) => {
    try {
      const eventPayload = {
        type: eventType,
        data: {
          movieId: movieData.movieId,
          movieName: movieData.movieName,
          cast: movieData.cast || [],
          director: movieData.director || '',
          genre: movieData.genre || [],
          ...(eventType === 'calification' && { rating: movieData.rating })
        }
      };

      const response = await fetch(`${EVENTS_HUB_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      });

      if (!response.ok) {
        console.error('Error sending event to hub:', response.status);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleMovieClick = async (movie) => {
    setSelectedMovie(movie);
    
    // Obtener detalles completos de la película
    const details = await fetchMovieDetails(movie.id);
    
    let movieData = {
      movieId: movie.id,
      movieName: movie.title,
      cast: [],
      director: '',
      genre: []
    };

    if (details) {
      // Extraer director
      if (details.credits && details.credits.crew) {
        const director = details.credits.crew.find(person => person.job === 'Director');
        movieData.director = director ? director.name : '';
      }
      
      // Extraer elenco (primeros 5 actores)
      if (details.credits && details.credits.cast) {
        movieData.cast = details.credits.cast.slice(0, 5).map(actor => actor.name);
      }
      
      // Extraer géneros
      if (details.genres) {
        movieData.genre = details.genres.map(g => g.name);
      }

      setMovieDetails(movieData);
    }

    // Enviar evento de click al hub
    await sendEventToHub('click', movieData);
  };

  const handlePlayClick = async () => {
    if (selectedMovie && Object.keys(movieDetails).length > 0) {
      await sendEventToHub('play', movieDetails);
      console.log('Evento de reproducción enviado');
    }
  };

  const handleOpenRatingModal = (movie) => {
    setRatingMovie(movie);
    setShowRatingModal(true);
    setSelectedRating(0);
  };

  const handleSubmitRating = async () => {
    if (selectedRating === 0) {
      setNotification({ show: true, message: 'Por favor selecciona una calificación', type: 'warning' });
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
      return;
    }

    const ratingData = {
      movieId: ratingMovie.id,
      movieName: ratingMovie.title,
      cast: movieDetails.cast || [],
      director: movieDetails.director || '',
      genre: movieDetails.genre || [],
      rating: selectedRating * 2
    };

    // Enviar evento de calificación al hub
    await sendEventToHub('calification', ratingData);

    setNotification({ show: true, message: '¡Calificación enviada exitosamente!', type: 'success' });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
    
    setShowRatingModal(false);
    setSelectedRating(0);
    setRatingMovie(null);
  };

  const RatingStars = ({ rating, onRate }) => {
    return (
      <div className="rating-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={`star ${star <= rating ? 'active' : ''}`}
            onClick={() => onRate(star)}
            title={`${star} estrella${star > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

  const Notification = () => {
    if (!notification.show) return null;
    
    return (
      <div className={`notification notification-${notification.type}`}>
        <p>{notification.message}</p>
      </div>
    );
  };

  const MovieCard = ({ movie }) => {
    const posterUrl = movie.poster_path ? 
      (movie.poster_path.startsWith('http') ? movie.poster_path : `${IMAGE_BASE_URL}/w500${movie.poster_path}`) : 
      PLACEHOLDER_POSTER;
    
    return (
      <div className="movie-card" onClick={() => handleMovieClick(movie)}>
        <img
          src={posterUrl}
          alt={movie.title}
          onError={(e) => {
            e.target.src = PLACEHOLDER_POSTER;
          }}
        />
        <div className="movie-info">
          <h3>{movie.title}</h3>
          <p>⭐ {movie.vote_average.toFixed(1)}</p>
        </div>
      </div>
    );
  };

  const MovieRow = ({ title, movies }) => {
    const listRef = useRef(null);
    const [scrollPosition, setScrollPosition] = useState(0);

    useEffect(() => {
      const interval = setInterval(() => {
        if (listRef.current) {
          const maxScroll = listRef.current.scrollWidth - listRef.current.clientWidth;
          if (scrollPosition >= maxScroll) {
            listRef.current.scrollTo({ left: 0, behavior: 'smooth' });
            setScrollPosition(0);
          } else {
            const newPosition = scrollPosition + 210; // Width of movie card + gap
            listRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
            setScrollPosition(newPosition);
          }
        }
      }, 5000);

      return () => clearInterval(interval);
    }, [scrollPosition]);

    const scroll = (direction) => {
      if (listRef.current) {
        const scrollAmount = direction === 'left' ? -420 : 420;
        const newPosition = scrollPosition + scrollAmount;
        listRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
        setScrollPosition(newPosition);
      }
    };

    return (
      <div className="movie-row">
        <h2>{title}</h2>
        <div className="movie-row-container">
          <button 
            className="scroll-button scroll-left" 
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            &#8249;
          </button>
          <div className="movie-list" ref={listRef}>
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
          <button 
            className="scroll-button scroll-right" 
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            &#8250;
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading">
        <h1>Cargando DCICflix...</h1>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Notification */}
      <Notification />
      <header className="header">
        <h1 className="logo">DCICflix</h1>
        <nav>
          <a href="#home">Inicio</a>
          <a href="#movies">Películas</a>
          <a href="#series">Series</a>
        </nav>
      </header>

      {/* Featured Movie */}
      {featuredMovie && (
        <div 
          className="featured"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.9)), url(${
              featuredMovie.backdrop_path && featuredMovie.backdrop_path.startsWith('http') 
                ? featuredMovie.backdrop_path 
                : `${IMAGE_BASE_URL}/original${featuredMovie.backdrop_path}`
            })`
          }}
        >
          <div className="featured-content">
            <h1 className="featured-title">{featuredMovie.title}</h1>
            <p className="featured-overview">{featuredMovie.overview}</p>
            <div className="featured-buttons">
              <button className="btn btn-play">▶ Reproducir</button>
              <button className="btn btn-info">ℹ Más información</button>
            </div>
          </div>
        </div>
      )}

      {/* Movie Sections */}
      <div className="content">
        <MovieRow title="Recomendadas" movies={popularMovies.slice(0, 10)} />
        <MovieRow title="Populares" movies={popularMovies.slice(10)} />
        <MovieRow title="Mejor Calificadas" movies={topRatedMovies} />
        <MovieRow title="Un poco de todo 🎲" movies={randomMovies} />
      </div>

      {/* Movie Modal */}
      {selectedMovie && (
        <div className="modal-overlay" onClick={() => setSelectedMovie(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedMovie(null)}>×</button>
            <div className="modal-header">
              <img
                src={
                  selectedMovie.poster_path && selectedMovie.poster_path.startsWith('http')
                    ? selectedMovie.poster_path
                    : `${IMAGE_BASE_URL}/w500${selectedMovie.poster_path}`
                }
                alt={selectedMovie.title}
                className="modal-poster"
                onError={(e) => {
                  e.target.src = PLACEHOLDER_POSTER;
                }}
              />
              <div className="modal-info">
                <h2>{selectedMovie.title}</h2>
                <div className="modal-meta">
                  <span className="rating">⭐ {selectedMovie.vote_average.toFixed(1)}</span>
                  <span className="release-date">
                    {selectedMovie.release_date ? new Date(selectedMovie.release_date).getFullYear() : 'N/A'}
                  </span>
                  {selectedMovie.original_language && (
                    <span className="language">{selectedMovie.original_language.toUpperCase()}</span>
                  )}
                </div>
                <p className="modal-overview">{selectedMovie.overview || 'Sin descripción disponible.'}</p>
                <div className="modal-buttons">
                  <button className="btn btn-play" onClick={handlePlayClick}>▶ Reproducir</button>
                  <button className="btn btn-rating" onClick={() => handleOpenRatingModal(selectedMovie)}>⭐ Calificar</button>
                  <button className="btn btn-info" onClick={() => setSelectedMovie(null)}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && ratingMovie && (
        <div className="modal-overlay" onClick={() => setShowRatingModal(false)}>
          <div className="modal-content rating-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowRatingModal(false)}>×</button>
            <div className="rating-modal-content">
              <h2>Calificar: {ratingMovie.title}</h2>
              <p className="rating-instruction">¿Qué te pareció esta película?</p>
              <RatingStars rating={selectedRating} onRate={setSelectedRating} />
              <div className="rating-display">
                {selectedRating > 0 && <p className="selected-rating">{selectedRating} de 5 estrellas</p>}
              </div>
              <div className="rating-modal-buttons">
                <button className="btn btn-play" onClick={handleSubmitRating}>
                  Enviar Calificación
                </button>
                <button className="btn btn-info" onClick={() => setShowRatingModal(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
