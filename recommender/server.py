from flask import Flask, jsonify, request
import os
from dotenv import load_dotenv
from recommender import RecommenderService

load_dotenv()

app = Flask(__name__)
PORT = int(os.getenv('PORT', 3005))

# Inicializar servicio de recomendación
recommender_service = RecommenderService(
    mongodb_uri_local=os.getenv('MONGODB_URI_LOCAL'),
    mongodb_uri_atlas=os.getenv('MONGODB_URI_ATLAS')
)

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({'status': 'Recommender service is running'})

@app.route('/api/recommendations', methods=['GET'])
def get_recommendations():
    """
    Obtiene recomendaciones para el usuario
    Query params:
    - num_recommendations: cantidad de recomendaciones (default: 5)
    """
    try:
        num_recommendations = int(request.args.get('num_recommendations', 5))
        recommendations = recommender_service.get_recommendations(num_recommendations)
        
        return jsonify({
            'success': True,
            'data': recommendations
        }), 200
    except Exception as error:
        print(f'✗ Error en recomendaciones: {error}')
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
    app.run(host='0.0.0.0', port=PORT, debug=True)
