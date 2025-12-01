import pandas as pd
import json
import os

class RecommenderService:
    def __init__(self):
        """
        Inicializa el servicio de recomendación
        Lee datos de volúmenes JSON locales
        """
        # Rutas de volúmenes
        self.clicks_dir = os.getenv('CLICKS_DIR', '/data/clicks')
        self.plays_dir = os.getenv('PLAYS_DIR', '/data/plays')
        self.ratings_dir = os.getenv('RATINGS_DIR', '/data/ratings')
        
        # API de películas
        self.api_movies_url = os.getenv('API_MOVIES_URL', 'http://api-movies:3007/api/movies')
    
    def load_json_file(self, filepath):
        """Carga un archivo JSON de forma segura"""
        try:
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f'⚠️  Error cargando {filepath}: {e}')
        return []
    
    def load_movie_weights(self):
        """Carga los pesos de películas desde el volumen"""
        weights_file = os.path.join(os.getenv('SERVER_DATA_DIR', '/server/data'), 'movie_weights.json')
        try:
            weights = self.load_json_file(weights_file)
            if weights:
                print(f'📊 Pesos cargados: {len(weights)} películas ponderadas')
                return weights
        except Exception as e:
            print(f'⚠️  Error cargando pesos: {e}')
        return {}
    
    def save_movie_weights(self, weights):
        """Guarda los pesos actualizados en el volumen"""
        weights_file = os.path.join(os.getenv('SERVER_DATA_DIR', '/server/data'), 'movie_weights.json')
        try:
            # Asegurar que el directorio existe
            os.makedirs(os.path.dirname(weights_file), exist_ok=True)
            
            # Guardar los pesos
            with open(weights_file, 'w', encoding='utf-8') as f:
                json.dump(weights, f, ensure_ascii=False, indent=2)
            print(f'💾 Pesos guardados: {len(weights)} películas actualizadas')
            return True
        except Exception as e:
            print(f'❌ Error guardando pesos: {e}')
            return False
    
    def get_user_history(self):
        """Obtiene el historial de eventos del usuario desde volúmenes JSON"""
        clicks_file = os.path.join(self.clicks_dir, 'clicks.json')
        plays_file = os.path.join(self.plays_dir, 'plays.json')
        ratings_file = os.path.join(self.ratings_dir, 'ratings.json')
        
        clicks = self.load_json_file(clicks_file)
        plays = self.load_json_file(plays_file)
        ratings = self.load_json_file(ratings_file)
        
        return {
            'clicks': pd.DataFrame(clicks) if clicks else pd.DataFrame(),
            'plays': pd.DataFrame(plays) if plays else pd.DataFrame(),
            'ratings': pd.DataFrame(ratings) if ratings else pd.DataFrame()
        }
    
    def get_all_movies(self):
        """Obtiene todas las películas desde la API con paginación"""
        try:
            import urllib.request
            import urllib.error
            
            all_movies = []
            page = 1  # Comenzar en página 1, no 0
            per_page = 100  # Cargar 100 películas por página
            
            while True:
                url = f"{self.api_movies_url}?page={page}&limit={per_page}"
                try:
                    response = urllib.request.urlopen(url, timeout=10)
                    data = json.loads(response.read().decode('utf-8'))
                    
                    # Manejar diferentes formatos de respuesta
                    movies = data.get('data', data.get('movies', []))
                    
                    if not movies:
                        break  # Sin más películas
                    
                    all_movies.extend(movies)
                    page += 1
                    
                    # Límite de seguridad: máximo 2000 películas (20 páginas)
                    if len(all_movies) >= 2000 or len(movies) < per_page:
                        break
                except Exception as e:
                    print(f'⚠️  Error cargando página {page}: {e}')
                    break
            
            print(f'📥 Total de películas cargadas: {len(all_movies)}')
            return pd.DataFrame(all_movies) if all_movies else pd.DataFrame()
        except Exception as e:
            print(f'⚠️  Error obteniendo películas desde API: {e}')
            return pd.DataFrame()

    
    def recommend_cold_start(self, num_recommendations=5):
        """
        Recomendador para usuario nuevo (sin historial)
        Toma la mejor película de cada género
        """
        print("📊 Modo COLD START: Sin historial de usuario")
        
        movies_df = self.get_all_movies()
        
        if movies_df.empty:
            print("⚠️  No hay películas disponibles")
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
    
    def calculate_adjusted_weights(self):
        """
        Retorna los pesos actuales guardados (que ya incluyen actualizaciones por interacciones)
        NO recalcula, solo devuelve lo que está en el volumen
        """
        # Cargar y retornar los pesos actuales tal como están guardados
        current_weights = self.load_movie_weights()
        if not current_weights:
            return {}
        return current_weights
    
    def update_weights_from_interaction(self, movie_id):
        """
        Actualiza y persiste los pesos en el volumen cuando el usuario interactúa con una película
        Aumenta el peso de películas con características similares
        """
        try:
            print(f'\n🎬 [ACTUALIZANDO PESOS] movieId: {movie_id}')
            
            # Obtener todas las películas
            print(f'   📥 Cargando todas las películas...')
            movies_df = self.get_all_movies()
            if movies_df.empty:
                print('❌ [ERROR] No hay películas disponibles para actualizar pesos')
                return False
            print(f'   ✓ {len(movies_df)} películas cargadas')
            
            # Cargar pesos actuales
            print(f'   📥 Cargando pesos actuales...')
            weights = self.load_movie_weights()
            if not weights:
                print('❌ [ERROR] No hay pesos disponibles')
                return False
            print(f'   ✓ {len(weights)} pesos cargados')
            
            # Buscar la película interactuada
            print(f'   🔍 Buscando película {movie_id}...')
            movie = movies_df[
                movies_df.apply(lambda x: str(x.get('_id', x.get('movieId', ''))) == movie_id, axis=1)
            ]
            
            if movie.empty:
                print(f'⚠️  [ADVERTENCIA] Película {movie_id} no encontrada')
                return False
            
            movie_data = movie.iloc[0]
            print(f'   ✓ Película encontrada: {movie_data.get("title", movie_id)}')
            
            # Extraer características de la película interactuada
            movie_genres = set(movie_data.get('genres', [])) if isinstance(movie_data.get('genres'), list) else set()
            movie_directors = set(movie_data.get('directors', [])) if isinstance(movie_data.get('directors'), list) else set()
            movie_cast = set(movie_data.get('cast', [])[:5]) if isinstance(movie_data.get('cast'), list) else set()
            
            print(f"\n   🎬 Características de película:")
            print(f"      - Géneros: {movie_genres}")
            print(f"      - Directores: {movie_directors}")
            print(f"      - Actores: {movie_cast}")
            
            # Recorrer todas las películas y aumentar peso de las similares
            print(f'   ⚙️  Iterando películas similares...')
            updated_count = 0
            for other_movie_id, weight_data in weights.items():
                # Saltar la película interactuada
                if other_movie_id == movie_id:
                    continue
                
                # Buscar la otra película
                other_movie = movies_df[
                    movies_df.apply(lambda x: str(x.get('_id', x.get('movieId', ''))) == other_movie_id, axis=1)
                ]
                
                if other_movie.empty:
                    continue
                
                other_movie_data = other_movie.iloc[0]
                
                # Contar coincidencias
                matches = 0
                
                # Coincidencias de géneros (30%)
                other_genres = set(other_movie_data.get('genres', [])) if isinstance(other_movie_data.get('genres'), list) else set()
                genre_matches = len(movie_genres & other_genres)
                matches += genre_matches * 0.3
                
                # Coincidencias de directores (50%)
                other_directors = set(other_movie_data.get('directors', [])) if isinstance(other_movie_data.get('directors'), list) else set()
                director_matches = len(movie_directors & other_directors)
                matches += director_matches * 0.5
                
                # Coincidencias de actores (20%)
                other_cast = set(other_movie_data.get('cast', [])[:5]) if isinstance(other_movie_data.get('cast'), list) else set()
                cast_matches = len(movie_cast & other_cast)
                matches += cast_matches * 0.2
                
                # Aumentar peso si hay coincidencias
                if matches > 0:
                    old_weight = weight_data.get('totalWeight', 1)
                    new_weight = old_weight * (1 + matches * 0.15)  # Aumento del 15% por cada punto de coincidencia
                    weights[other_movie_id]['totalWeight'] = new_weight
                    updated_count += 1
                    
                    print(f"      ↑ {other_movie_data.get('title', other_movie_id)[:40]}: {old_weight:.2f} → {new_weight:.2f}")
            
            # Guardar pesos actualizados en el volumen
            print(f'   💾 Guardando {updated_count} pesos actualizados...')
            if self.save_movie_weights(weights):
                print(f"\n✅ [ÉXITO] {updated_count} películas tuvieron su peso aumentado")
                return True
            else:
                print('❌ [ERROR] Error al guardar pesos')
                return False
        except Exception as e:
            import traceback
            print(f'❌ [EXCEPTION] Error en update_weights_from_interaction: {e}')
            traceback.print_exc()
            return False
    
    def get_weighted_movies(self, num_weighted=5):
        """
        Obtiene películas con mayor peso ajustado dinámicamente
        Aumenta el peso de películas con características similares a las vistas
        """
        movies_df = self.get_all_movies()
        history = self.get_user_history()
        
        if movies_df.empty:
            print('⚠️  No hay películas disponibles en API')
            return []
        
        # Cargar y ajustar pesos dinámicamente
        weights = self.calculate_adjusted_weights()
        if not weights:
            print('⚠️  No hay pesos disponibles en el volumen')
            return []
        
        # Películas ya interactuadas (no recomendar)
        interacted_movies = set()
        
        if not history['clicks'].empty:
            interacted_movies.update(history['clicks']['movieId'].astype(str).unique())
        if not history['plays'].empty:
            interacted_movies.update(history['plays']['movieId'].astype(str).unique())
        if not history['ratings'].empty:
            interacted_movies.update(history['ratings']['movieId'].astype(str).unique())
        
        print(f"📊 Películas interactuadas: {len(interacted_movies)}")
        
        # Crear lista de películas con sus pesos, excluyendo ya vistas
        weighted_list = []
        
        for movie_id, weight_data in weights.items():
            # Saltar películas ya vistas
            if movie_id in interacted_movies:
                continue
            
            # Obtener peso total
            total_weight = weight_data.get('totalWeight', 1)
            if total_weight <= 1:  # Solo películas con peso real (>1)
                continue
            
            weighted_list.append({
                'movieId': movie_id,
                'weight': total_weight,
                'movieName': weight_data.get('movieName', '')
            })
        
        # Ordenar por peso descendente
        weighted_list.sort(key=lambda x: x['weight'], reverse=True)
        
        print(f"🎯 Top películas por peso:")
        for i, item in enumerate(weighted_list[:num_weighted]):
            print(f"   {i+1}. {item['movieName']} (peso: {item['weight']:.1f})")
        
        # Convertir a recomendaciones buscando en la API
        weighted_recommendations = []
        
        for item in weighted_list[:num_weighted]:
            movie_id = item['movieId']
            
            # Buscar la película en el DataFrame
            movie = movies_df[
                movies_df.apply(lambda x: str(x.get('_id', x.get('movieId', ''))) == movie_id, axis=1)
            ]
            
            if not movie.empty:
                movie_data = movie.iloc[0]
                weighted_recommendations.append({
                    'movieId': movie_id,
                    'movieName': movie_data.get('movieName', movie_data.get('title', '')),
                    'genre': movie_data.get('genre', ''),
                    'director': movie_data.get('director', ''),
                    'reason': f'Popular entre usuarios (peso: {item["weight"]:.1f})',
                    'score': float(movie_data.get('rating', 0))
                })
            else:
                print(f"⚠️  Película {movie_id} no encontrada en API")
        
        print(f"✓ {len(weighted_recommendations)} películas recomendadas con pesos")
        return weighted_recommendations
    
    def get_generic_recommendations(self, num_recommendations=5, exclude_movies=None):
        """
        Genera recomendaciones genéricas por género
        """
        movies_df = self.get_all_movies()
        
        if movies_df.empty:
            return []
        
        if exclude_movies is None:
            exclude_movies = set()
        
        recommendations = []
        
        # Agrupar por género y tomar la mejor (por rating si existe)
        if 'genre' in movies_df.columns:
            for genre in movies_df['genre'].unique():
                genre_movies = movies_df[movies_df['genre'] == genre]
                # Excluir películas ya recomendadas
                genre_movies = genre_movies[
                    ~genre_movies.apply(lambda x: str(x.get('_id', x.get('movieId', ''))) in exclude_movies, axis=1)
                ]
                
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
                        'reason': f'Top en género: {genre}',
                        'score': float(best_movie.get('rating', 0))
                    })
        
        # Limitar a num_recommendations
        return recommendations[:num_recommendations]
    
    def get_recommendations(self, num_recommendations=10):
        """
        Orquestador principal con 3 fases
        Fase 1 (0-4): 100% genérica
        Fase 2 (5-9): 5 ponderadas + 5 genéricas
        Fase 3 (10+): 8 ponderadas + 2 genéricas
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
        print(f"   - Calificaciones: {len(history['ratings'])}")
        print(f"   - Plays: {len(history['plays'])}")
        
        recommendations = []
        
        # FASE 1: Menos de 5 interacciones - 100% Genérica
        if total_interactions < 5:
            print(f"⏳ FASE 1 - GENÉRICA (0-4 interacciones)")
            print(f"   Necesitas {5 - total_interactions} interacciones más")
            recommendations = self.get_generic_recommendations(num_recommendations)
        
        # FASE 2: 5 a 9 interacciones - 5 ponderadas + 5 genéricas
        elif total_interactions < 10:
            print(f"📈 FASE 2 - MIXTA (5-9 interacciones)")
            print(f"   5 películas ponderadas + 5 genéricas")
            print(f"   Necesitas {10 - total_interactions} interacciones más para personalización completa")
            
            weighted = self.get_weighted_movies(num_weighted=5)
            exclude_ids = {m['movieId'] for m in weighted}
            generic = self.get_generic_recommendations(num_recommendations - len(weighted), exclude_ids)
            recommendations = weighted + generic
        
        # FASE 3: 10+ interacciones - 8 ponderadas + 2 genéricas
        else:
            print(f"🔥 FASE 3 - PERSONALIZADA (10+ interacciones)")
            print(f"   8 películas ponderadas + 2 genéricas")
            
            weighted = self.get_weighted_movies(num_weighted=8)
            exclude_ids = {m['movieId'] for m in weighted}
            generic = self.get_generic_recommendations(num_recommendations - len(weighted), exclude_ids)
            recommendations = weighted + generic
        
        print(f"✓ {len(recommendations)} películas recomendadas")
        print(f"===================\n")
        return recommendations
    
    def print_top_weighted_movies(self, limit=10):
        """
        Imprime las películas con mayor peso en console
        """
        weights = self.load_movie_weights()
        if not weights:
            print('⚠️  No hay pesos disponibles')
            return
        
        # Crear lista con películas y pesos
        weighted_list = []
        for movie_id, weight_data in weights.items():
            total_weight = weight_data.get('totalWeight', 1)
            weighted_list.append({
                'movieId': movie_id,
                'movieName': weight_data.get('movieName', 'Desconocida'),
                'weight': total_weight
            })
        
        # Ordenar por peso descendente
        weighted_list.sort(key=lambda x: x['weight'], reverse=True)
        
        # Imprimir top 10
        print("\n" + "="*80)
        print("🏆 TOP 10 PELÍCULAS CON MAYOR PESO".center(80))
        print("="*80)
        print(f"{'#':<3} {'Película':<50} {'Peso':<10} {'ID':<15}")
        print("-"*80)
        
        for i, movie in enumerate(weighted_list[:limit], 1):
            movie_name = movie['movieName'][:47] + "..." if len(movie['movieName']) > 50 else movie['movieName']
            print(f"{i:<3} {movie_name:<50} {movie['weight']:<10.1f} {movie['movieId']:<15}")
        
        print("="*80 + "\n")
