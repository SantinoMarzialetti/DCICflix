import pandas as pd
from pymongo import MongoClient
import os

class RecommenderService:
    def __init__(self, mongodb_uri_local, mongodb_uri_atlas):
        """
        Inicializa el servicio de recomendación
        
        Args:
            mongodb_uri_local: URI a MongoDB local (eventos del usuario)
            mongodb_uri_atlas: URI a MongoDB Atlas (catálogo de películas)
        """
        # Conexión a MongoDB local (eventos)
        self.client_local = MongoClient(mongodb_uri_local)
        self.db_local = self.client_local['dcicflix_db']
        
        # Conexión a MongoDB Atlas (películas)
        self.client_atlas = MongoClient(mongodb_uri_atlas)
        self.db_atlas = self.client_atlas['DCICflix']
        
        # Colecciones
        self.clicks = self.db_local['clicks']
        self.califications = self.db_local['califications']
        self.plays = self.db_local['plays']
        self.movies = self.db_atlas['movies']
    
    def get_user_history(self):
        """Obtiene el historial de eventos del usuario"""
        clicks_df = pd.DataFrame(list(self.clicks.find({}, {'_id': 0})))
        califications_df = pd.DataFrame(list(self.califications.find({}, {'_id': 0})))
        plays_df = pd.DataFrame(list(self.plays.find({}, {'_id': 0})))
        
        return {
            'clicks': clicks_df if not clicks_df.empty else pd.DataFrame(),
            'califications': califications_df if not califications_df.empty else pd.DataFrame(),
            'plays': plays_df if not plays_df.empty else pd.DataFrame()
        }
    
    def get_all_movies(self):
        """Obtiene todas las películas del catálogo"""
        movies = list(self.movies.find({}, {'_id': 0}))
        return pd.DataFrame(movies)
    
    def recommend_cold_start(self, num_recommendations=5):
        """
        Recomendador para usuario nuevo (sin historial)
        Toma la mejor película de cada género
        """
        print("📊 Modo COLD START: Sin historial de usuario")
        
        movies_df = self.get_all_movies()
        
        if movies_df.empty:
            print("⚠️  No hay películas en el catálogo")
            return []
        
        # Agrupar por género y tomar la mejor (por rating si existe)
        recommendations = []
        
        # Si hay columna 'genres', usarla; si no, asumir que todas van juntas
        if 'genre' in movies_df.columns:
            for genre in movies_df['genre'].unique():
                genre_movies = movies_df[movies_df['genre'] == genre]
                if not genre_movies.empty:
                    # Ordenar por rating si existe, si no por nombre
                    if 'rating' in genre_movies.columns:
                        best_movie = genre_movies.nlargest(1, 'rating').iloc[0]
                    else:
                        best_movie = genre_movies.iloc[0]
                    
                    recommendations.append({
                        'movieId': str(best_movie.get('_id', best_movie.get('movieId', ''))),
                        'movieName': best_movie.get('movieName', ''),
                        'genre': genre,
                        'reason': f'Mejor película de {genre}',
                        'score': float(best_movie.get('rating', 0))
                    })
        else:
            # Si no hay géneros, simplemente tomar las mejores N películas
            if 'rating' in movies_df.columns:
                top_movies = movies_df.nlargest(num_recommendations, 'rating')
            else:
                top_movies = movies_df.head(num_recommendations)
            
            recommendations = top_movies[['_id', 'movieName']].to_dict('records')
        
        # Limitar a num_recommendations
        recommendations = recommendations[:num_recommendations]
        print(f"✓ {len(recommendations)} películas recomendadas (cold start)")
        
        return recommendations
    
    def recommend_collaborative(self, num_recommendations=5):
        """
        Recomendador basado en gustos del usuario (con historial)
        Pondera: Clicks (1x), Calificaciones (2x), Plays (3x)
        """
        print("📊 Modo COLLABORATIVE: Con historial de usuario")
        
        history = self.get_user_history()
        movies_df = self.get_all_movies()
        
        if movies_df.empty:
            print("⚠️  No hay películas en el catálogo")
            return []
        
        # Calcular score por película basado en interacciones
        movie_scores = {}
        
        # Procesar clicks (peso: 1)
        if not history['clicks'].empty:
            for _, row in history['clicks'].iterrows():
                movie_id = str(row.get('movieId', ''))
                if movie_id:
                    movie_scores[movie_id] = movie_scores.get(movie_id, 0) + 1
        
        # Procesar calificaciones (peso: 2)
        if not history['califications'].empty:
            for _, row in history['califications'].iterrows():
                movie_id = str(row.get('movieId', ''))
                rating = row.get('rating', 0)
                if movie_id:
                    movie_scores[movie_id] = movie_scores.get(movie_id, 0) + (rating * 2)
        
        # Procesar plays (peso: 3)
        if not history['plays'].empty:
            for _, row in history['plays'].iterrows():
                movie_id = str(row.get('movieId', ''))
                if movie_id:
                    movie_scores[movie_id] = movie_scores.get(movie_id, 0) + 3
        
        if not movie_scores:
            print("⚠️  Sin historial suficiente, activando cold start")
            return self.recommend_cold_start(num_recommendations)
        
        # Películas ya vistas
        watched_movies = set(movie_scores.keys())
        
        # Encontrar películas similares (mismo género)
        watched_genres = set()
        for movie_id in watched_movies:
            movie = movies_df[movies_df.apply(lambda x: str(x.get('_id', x.get('movieId', ''))) == movie_id, axis=1)]
            if not movie.empty:
                if 'genre' in movie.columns:
                    genres = movie.iloc[0].get('genre', [])
                    if isinstance(genres, list):
                        watched_genres.update(genres)
                    else:
                        watched_genres.add(genres)
        
        # Recomendar películas del mismo género no vistas
        recommendations = []
        
        if watched_genres:
            # Filtrar películas por género visto
            similar_movies = movies_df[
                movies_df.apply(
                    lambda x: any(g in x.get('genre', []) for g in watched_genres) 
                    if isinstance(x.get('genre', []), list) 
                    else x.get('genre', '') in watched_genres,
                    axis=1
                )
            ]
            
            # Excluir películas ya vistas
            similar_movies = similar_movies[
                ~similar_movies.apply(lambda x: str(x.get('_id', x.get('movieId', ''))) in watched_movies, axis=1)
            ]
        else:
            # Si no hay géneros, recomendar películas no vistas
            similar_movies = movies_df[
                ~movies_df.apply(lambda x: str(x.get('_id', x.get('movieId', ''))) in watched_movies, axis=1)
            ]
        
        # Ordenar por rating si existe
        if 'rating' in similar_movies.columns:
            similar_movies = similar_movies.sort_values('rating', ascending=False)
        
        for _, movie in similar_movies.head(num_recommendations).iterrows():
            recommendations.append({
                'movieId': str(movie.get('_id', movie.get('movieId', ''))),
                'movieName': movie.get('movieName', ''),
                'genre': movie.get('genre', ''),
                'reason': 'Basado en tus gustos',
                'score': float(movie.get('rating', 0))
            })
        
        print(f"✓ {len(recommendations)} películas recomendadas (collaborative)")
        return recommendations
    
    def get_recommendations(self, num_recommendations=5):
        """
        Orquestador principal
        Decide entre cold start o collaborative basado en historial
        """
        history = self.get_user_history()
        
        # Contar interacciones totales
        total_interactions = (
            len(history['clicks']) + 
            len(history['califications']) + 
            len(history['plays'])
        )
        
        print(f"\n=== RECOMENDADOR ===")
        print(f"📊 Interacciones del usuario: {total_interactions}")
        print(f"   - Clicks: {len(history['clicks'])}")
        print(f"   - Calificaciones: {len(history['califications'])}")
        print(f"   - Plays: {len(history['plays'])}")
        
        # Decidir estrategia: cold start si menos de 2 interacciones
        if total_interactions < 2:
            recommendations = self.recommend_cold_start(num_recommendations)
        else:
            recommendations = self.recommend_collaborative(num_recommendations)
        
        print(f"===================\n")
        return recommendations
