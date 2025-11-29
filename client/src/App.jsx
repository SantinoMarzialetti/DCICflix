import { useState, useEffect, useRef } from 'react';
import './App.css';
import placeholderImage from './assets/placeholder-poster.svg';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const RANDOM_API_URL = import.meta.env.VITE_RANDOM_API_URL || 'http://localhost:3001/api';
const MOVIES_API_URL = import.meta.env.VITE_MOVIES_API_URL || 'http://localhost:3007/api/movies';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const PLACEHOLDER_POSTER = placeholderImage;

function App() {
  const [featuredMovie, setFeaturedMovie] = useState(null);
  const [popularMovies, setPopularMovies] = useState([]);
  const [randomMovies, setRandomMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingMovie, setRatingMovie] = useState(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [movieDetails, setMovieDetails] = useState({});
  const [currentMovieData, setCurrentMovieData] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      
      // Fetch random movie for hero section
      try {
        console.log('Fetching random movie from:', RANDOM_API_URL);
        const randomMovieRes = await fetch(`${RANDOM_API_URL}/random-movie`);
        const randomMovieData = await randomMovieRes.json();
        console.log('Random movie response:', randomMovieData);
        
        // El endpoint retorna { success: true, movie: {...} }
        const movieData = randomMovieData.movie || randomMovieData;
        
        if (movieData && movieData.title) {
          const heroMovie = {
            id: movieData._id || movieData.id,
            title: movieData.title,
            poster_path: movieData.poster || '',
            backdrop_path: movieData.poster || '',
            vote_average: movieData.imdb?.rating || 0,
            overview: movieData.plot || movieData.fullplot || '',
            release_date: movieData.released ? new Date(movieData.released).toISOString().split('T')[0] : null,
            original_language: 'en',
            poster: movieData.poster || '',
            genres: movieData.genres || [],
            director: movieData.directors?.[0] || '',
            cast: movieData.cast || []
          };
          console.log('Hero movie set:', heroMovie);
          setFeaturedMovie(heroMovie);
        }
      } catch (error) {
        console.warn('Error fetching random movie for hero:', error);
      }
      
      // Fetch popular movies from new API
      console.log('Fetching popular movies from:', MOVIES_API_URL);
      const popularRes = await fetch(`${MOVIES_API_URL}?page=1&limit=20`);
      const popularData = await popularRes.json();
      console.log('Popular movies response:', popularData);
      
      const moviesFromAPI = (popularData.data || []).map(movie => ({
        id: movie._id,
        title: movie.title,
        poster_path: movie.poster || '',
        backdrop_path: movie.poster || '',
        vote_average: movie.imdb?.rating || 0,
        overview: movie.plot || movie.fullplot || '',
        release_date: movie.released ? new Date(movie.released).toISOString().split('T')[0] : null,
        original_language: 'en',
        poster: movie.poster || '',
        genres: movie.genres || [],
        director: movie.directors?.[0] || '',
        cast: movie.cast || []
      }));
      
      console.log('Processed movies:', moviesFromAPI);
      setPopularMovies(moviesFromAPI);
      
      // Fetch random movies from microservice
      const randomRes = await fetch(`${RANDOM_API_URL}/random-movies?count=20`);
      const randomData = await randomRes.json();
      console.log('Random movies data:', randomData);
      
      // El endpoint retorna { success: true, count: N, movies: [...] }
      const randomMoviesList = (randomData.movies || randomData.data || []).map(movie => ({
        id: movie._id || movie.id,
        title: movie.title,
        poster_path: movie.poster || '',
        backdrop_path: movie.poster || '',
        vote_average: movie.imdb?.rating || 0,
        overview: movie.plot || movie.fullplot || '',
        release_date: movie.released ? new Date(movie.released).toISOString().split('T')[0] : null,
        original_language: 'en',
        poster: movie.poster || ''
      }));
      setRandomMovies(randomMoviesList);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching movies:', error);
      setLoading(false);
    }
  };

  const fetchMovieDetails = async (movieId) => {
    try {
      console.log('Intentando obtener detalles de película desde:', `${API_URL}/movies/${movieId}`);
      const response = await fetch(`${API_URL}/movies/${movieId}`);
      if (!response.ok) {
        console.warn('Endpoint de detalles no disponible:', response.status);
        return null;
      }
      const data = await response.json();
      console.log('Detalles obtenidos:', data);
      return data;
    } catch (error) {
      console.warn('No se pudieron obtener detalles de película, usando datos básicos:', error.message);
      return null;
    }
  };

  const sendEventToHub = async (eventType, movieData) => {
    try {
      let endpoint = '';
      
      // Los eventos se envían al servidor principal en la raíz
      if (eventType === 'click') {
        endpoint = `${API_URL}/events/click`;
      } else if (eventType === 'play') {
        endpoint = `${API_URL}/events/play`;
      } else if (eventType === 'calification') {
        endpoint = `${API_URL}/events/calification`;
      }

      if (!endpoint) {
        console.error('Endpoint desconocido para evento:', eventType);
        return;
      }

      const payload = {
        movieId: movieData.movieId,
        movieName: movieData.movieName,
        cast: movieData.cast || [],
        director: movieData.director || '',
        genre: movieData.genre || [],
        ...(eventType === 'calification' && { rating: movieData.rating })
      };

      console.log(`📡 Enviando evento ${eventType} a ${endpoint}:`, payload);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`❌ Error enviando evento ${eventType}:`, response.status, response.statusText);
      } else {
        const result = await response.json();
        console.log(`✅ Evento ${eventType} enviado exitosamente:`, result);
      }
    } catch (error) {
      console.error(`❌ Error en sendEventToHub (${eventType}):`, error);
    }
  };

  const handleMovieClick = async (movie) => {
    setSelectedMovie(movie);
    
    // Preparar datos básicos de la película
    let movieData = {
      movieId: movie.id,
      movieName: movie.title,
      cast: movie.cast || [],
      director: movie.director || '',
      genre: movie.genres || []
    };

    console.log('📌 Película clickeada, datos iniciales:', movieData);
    
    // Intentar obtener detalles completos de la película
    const details = await fetchMovieDetails(movie.id);
    
    if (details) {
      // Extraer director si está disponible
      if (details.credits && details.credits.crew) {
        const director = details.credits.crew.find(person => person.job === 'Director');
        if (director) movieData.director = director.name;
      }
      
      // Extraer elenco (primeros 5 actores) si está disponible
      if (details.credits && details.credits.cast) {
        movieData.cast = details.credits.cast.slice(0, 5).map(actor => actor.name);
      }
      
      // Extraer géneros si está disponible
      if (details.genres) {
        movieData.genre = details.genres.map(g => g.name);
      }

      setMovieDetails(movieData);
      console.log('📌 Detalles complementarios agregados:', movieData);
    }

    // Guardar datos actuales en currentMovieData para uso en handlePlayClick
    // (Usar setCurrentMovieData aquí de forma sincrónica para que esté disponible inmediatamente)
    setCurrentMovieData(movieData);

    // Enviar evento de click al hub
    console.log('📤 Enviando evento click con datos:', movieData);
    await sendEventToHub('click', movieData);
  };

  const handlePlayClick = async () => {
    console.log('▶️ Botón play clickeado');
    console.log('currentMovieData:', currentMovieData);
    
    if (currentMovieData && currentMovieData.movieId) {
      console.log('📤 Enviando evento play con datos:', currentMovieData);
      await sendEventToHub('play', currentMovieData);
      console.log('✅ Evento play enviado');
    } else {
      console.error('❌ No hay datos de película para enviar play');
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
      cast: currentMovieData?.cast || [],
      director: currentMovieData?.director || '',
      genre: currentMovieData?.genre || [],
      rating: selectedRating * 2
    };

    console.log('⭐ Enviando calification con datos:', ratingData);

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
      <div 
        className="featured"
        style={{
          backgroundImage: featuredMovie?.backdrop_path 
            ? `linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.8) 100%), url(${
                featuredMovie.backdrop_path.startsWith('http') 
                  ? featuredMovie.backdrop_path 
                  : `${IMAGE_BASE_URL}/original${featuredMovie.backdrop_path}`
              })`
            : 'linear-gradient(135deg, rgba(20,20,20,1) 0%, rgba(40,40,40,1) 100%)'
        }}
      >
        <div className="featured-content">
          {featuredMovie ? (
            <>
              <h1 className="featured-title">{featuredMovie.title}</h1>
              
              <div className="featured-rating">
                <div className="stars">
                  <span>⭐ {featuredMovie.vote_average.toFixed(1)}</span>
                </div>
                {featuredMovie.release_date && (
                  <span className="year">{new Date(featuredMovie.release_date).getFullYear()}</span>
                )}
              </div>

              <p className="featured-overview">{featuredMovie.overview}</p>
              
              <div className="featured-buttons">
                <button className="btn btn-play" onClick={handlePlayClick}>▶ Reproducir</button>
                <button className="btn btn-info" onClick={() => handleMovieClick(featuredMovie)}>ℹ Más información</button>
              </div>
            </>
          ) : (
            <div className="featured-placeholder">
              <p>Cargando película destacada...</p>
            </div>
          )}
        </div>
      </div>

      {/* Movie Sections */}
      <div className="content">
        <MovieRow title="Recomendadas" movies={popularMovies.slice(0, 10)} />
        <MovieRow title="Populares" movies={popularMovies.slice(10)} />
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
