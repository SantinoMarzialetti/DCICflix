import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = 'http://localhost:3000/api';
const RANDOM_API_URL = 'http://localhost:3001/api';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

function App() {
  const [featuredMovie, setFeaturedMovie] = useState(null);
  const [popularMovies, setPopularMovies] = useState([]);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [randomMovies, setRandomMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState(null);

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      
      // Fetch popular movies
      const popularRes = await fetch(`${API_URL}/movies/popular`);
      const popularData = await popularRes.json();
      setPopularMovies(popularData.results || []);
      
      // Fetch top rated movies
      const topRatedRes = await fetch(`${API_URL}/movies/top-rated`);
      const topRatedData = await topRatedRes.json();
      setTopRatedMovies(topRatedData.results || []);
      
      // Fetch random movies from microservice
      const randomRes = await fetch(`${RANDOM_API_URL}/random-movies?count=20`);
      const randomData = await randomRes.json();
      setRandomMovies(randomData.movies || []);
      
      // Set random featured movie from popular
      if (popularData.results && popularData.results.length > 0) {
        const randomMovie = popularData.results[Math.floor(Math.random() * popularData.results.length)];
        setFeaturedMovie(randomMovie);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching movies:', error);
      setLoading(false);
    }
  };

  const MovieCard = ({ movie }) => (
    <div className="movie-card" onClick={() => setSelectedMovie(movie)}>
      <img
        src={`${IMAGE_BASE_URL}/w500${movie.poster_path}`}
        alt={movie.title}
        onError={(e) => {
          e.target.src = 'https://via.placeholder.com/500x750?text=No+Image';
        }}
      />
      <div className="movie-info">
        <h3>{movie.title}</h3>
        <p>⭐ {movie.vote_average.toFixed(1)}</p>
      </div>
    </div>
  );

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
      {/* Header */}
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
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.9)), url(${IMAGE_BASE_URL}/original${featuredMovie.backdrop_path})`
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
                src={`${IMAGE_BASE_URL}/w500${selectedMovie.poster_path}`}
                alt={selectedMovie.title}
                className="modal-poster"
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/500x750?text=No+Image';
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
                  <button className="btn btn-play">▶ Reproducir</button>
                  <button className="btn btn-info" onClick={() => setSelectedMovie(null)}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
