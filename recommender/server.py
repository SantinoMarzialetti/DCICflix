from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv
from recommender import RecommenderService

load_dotenv()

app = Flask(__name__)

# Habilitar CORS para todas las rutas
CORS(app, resources={r"/api/*": {"origins": "*"}})

PORT = int(os.getenv('PORT', 3005))

# Inicializar servicio de recomendación
recommender_service = RecommenderService()

# Mostrar top 10 películas al iniciar
print("\n" + "="*80)
print("⚙️  RECOMENDADOR INICIADO".center(80))
print("="*80)
recommender_service.print_top_weighted_movies(10)

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({'status': 'Recommender service is running'})

@app.route('/api/recommendations/top-weighted', methods=['GET'])
def get_top_weighted_ids():
    """
    Retorna los 10 IDs de películas con mayor peso ajustado
    Los pesos se ajustan dinámicamente según el historial del usuario
    El frontend usa estos IDs para pedir detalles a api-movies
    """
    try:
        limit = int(request.args.get('limit', 10))
        # Cargar y ajustar pesos dinámicamente
        weights = recommender_service.calculate_adjusted_weights()
        
        if not weights:
            return jsonify({
                'success': False,
                'error': 'No hay pesos disponibles'
            }), 404
        
        # Obtener películas ya vistas para excluirlas
        history = recommender_service.get_user_history()
        interacted_movies = set()
        
        if not history['clicks'].empty:
            interacted_movies.update(history['clicks']['movieId'].astype(str).unique())
        if not history['plays'].empty:
            interacted_movies.update(history['plays']['movieId'].astype(str).unique())
        if not history['ratings'].empty:
            interacted_movies.update(history['ratings']['movieId'].astype(str).unique())
        
        # Crear lista ordenada por peso, excluyendo películas ya vistas
        weighted_list = []
        for movie_id, weight_data in weights.items():
            # Saltar películas ya vistas
            if movie_id in interacted_movies:
                continue
            
            total_weight = weight_data.get('totalWeight', 0)
            weighted_list.append({
                'movieId': movie_id,
                'weight': total_weight,
                'movieName': weight_data.get('movieName', '')
            })
        
        # Ordenar por peso descendente
        weighted_list.sort(key=lambda x: x['weight'], reverse=True)
        
        # Tomar top N
        top_movies = weighted_list[:limit]
        
        # Extraer solo IDs
        movie_ids = [m['movieId'] for m in top_movies]
        
        return jsonify({
            'success': True,
            'count': len(movie_ids),
            'movieIds': movie_ids,
            'movies': top_movies
        }), 200
    except Exception as error:
        print(f'✗ Error obteniendo top películas ponderadas: {error}')
        return jsonify({
            'success': False,
            'error': str(error)
        }), 500

@app.route('/api/recommendations', methods=['GET'])
def get_recommendations():
    """
    Obtiene recomendaciones para el usuario
    Query params:
    - limit: cantidad de recomendaciones (default: 10)
    """
    try:
        num_recommendations = int(request.args.get('limit', 10))
        recommendations = recommender_service.get_recommendations(num_recommendations)
        
        return jsonify({
            'success': True,
            'data': recommendations,
            'count': len(recommendations)
        }), 200
    except Exception as error:
        print(f'✗ Error en recomendaciones: {error}')
        return jsonify({
            'success': False,
            'error': str(error)
        }), 500

@app.route('/api/recommendations/update-weights', methods=['POST'])
def update_weights():
    """
    Actualiza los pesos de películas basado en una interacción del usuario
    Body: { "movieId": "..." }
    """
    try:
        data = request.get_json()
        
        if data is None:
            return jsonify({
                'success': False,
                'error': 'Invalid JSON'
            }), 400
        
        movie_id = data.get('movieId')
        
        if not movie_id:
            return jsonify({
                'success': False,
                'error': 'movieId es requerido'
            }), 400
        
        # Actualizar pesos en el volumen
        result = recommender_service.update_weights_from_interaction(movie_id)
        
        return jsonify({
            'success': result,
            'message': 'Pesos actualizados correctamente' if result else 'Error actualizando pesos'
        }), 200 if result else 500
    except Exception as error:
        import traceback
        print(f'❌ Error actualizando pesos: {error}')
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(error)
        }), 500

@app.route('/api/recommendations/cold-start', methods=['GET'])
def cold_start_recommendations():
    """Fuerza recomendaciones de cold start"""
    try:
        num_recommendations = int(request.args.get('num_recommendations', 5))
        recommendations = recommender_service.recommend_cold_start(num_recommendations)
        
        return jsonify({
            'success': True,
            'data': recommendations,
            'mode': 'cold_start'
        }), 200
    except Exception as error:
        print(f'✗ Error en cold start: {error}')
        return jsonify({
            'success': False,
            'error': str(error)
        }), 500

@app.route('/api/recommendations/collaborative', methods=['GET'])
def collaborative_recommendations():
    """Fuerza recomendaciones colaborativas"""
    try:
        num_recommendations = int(request.args.get('num_recommendations', 5))
        recommendations = recommender_service.recommend_collaborative(num_recommendations)
        
        return jsonify({
            'success': True,
            'data': recommendations,
            'mode': 'collaborative'
        }), 200
    except Exception as error:
        print(f'✗ Error en collaborative: {error}')
        return jsonify({
            'success': False,
            'error': str(error)
        }), 500

if __name__ == '__main__':
    print(f'✓ Recomendador ejecutándose en puerto {PORT}')
    print(f'\n📚 Endpoints disponibles:')
    print(f'   GET /api/health')
    print(f'   GET /api/recommendations?limit=10')
    print(f'   GET /api/recommendations/top-weighted?limit=10')
    app.run(host='0.0.0.0', port=PORT, debug=True)
