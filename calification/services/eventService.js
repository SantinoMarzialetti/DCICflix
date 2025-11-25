const { publishMessage } = require('../rabbitmq/connection');

class EventService {
  
  //Procesar evento según tipo y encolarlo en la cola correspondiente
   
  async processEvent(eventType, data) {
    switch (eventType.toLowerCase()) {
      case 'click':
        return await this.handleClickEvent(data);
      case 'calification':
        return await this.handleCalificationEvent(data);
      case 'play':
        return await this.handlePlayEvent(data);
      default:
        throw new Error(`Tipo de evento no válido: ${eventType}`);
    }
  }

  /**
   * Manejar evento de click en una película
   */
  async handleClickEvent(data) {
    try {
      // Validar datos requeridos
      if (!data.movieId || !data.movieName) {
        throw new Error('movieId y movieName son requeridos');
      }

      // Publicar en RabbitMQ
      await publishMessage('movie.clicked', {
        movieId: data.movieId,
        movieName: data.movieName,
        cast: data.cast || [],
        director: data.director || null,
        genre: data.genre || []
      });

      console.log('✓ Evento click publicado en RabbitMQ');

      return { 
        success: true, 
        message: 'Evento click procesado exitosamente',
        data: {
          movieId: data.movieId,
          movieName: data.movieName,
          cast: data.cast || [],
          director: data.director || null,
          genre: data.genre || []
        }
      };
    } catch (error) {
      console.error('✗ Error en handleClickEvent:', error);
      throw error;
    }
  }

  /**
   * Manejar evento de calificación de una película
   */
  async handleCalificationEvent(data) {
    try {
      // Validar datos requeridos
      if (!data.movieId || !data.rating) {
        throw new Error('movieId y rating son requeridos');
      }

      // Validar rating
      if (data.rating < 1 || data.rating > 10 || !Number.isInteger(data.rating)) {
        throw new Error('El rating debe ser un número entero entre 1 y 10');
      }

      // Publicar en RabbitMQ
      await publishMessage('movie.rated', {
        movieId: data.movieId,
        movieName: data.movieName || '',
        cast: data.cast || [],
        director: data.director || null,
        genre: data.genre || [],
        rating: data.rating
      });

      console.log('✓ Evento calification publicado en RabbitMQ');

      return { 
        success: true, 
        message: 'Evento calification procesado exitosamente',
        data: {
          movieId: data.movieId,
          movieName: data.movieName || '',
          cast: data.cast || [],
          director: data.director || null,
          genre: data.genre || [],
          rating: data.rating
        }
      };
    } catch (error) {
      console.error('✗ Error en handleCalificationEvent:', error);
      throw error;
    }
  }

  /**
   * Manejar evento de reproducción/play de una película
   */
  async handlePlayEvent(data) {
    try {
      // Validar datos requeridos
      if (!data.movieId || !data.movieName) {
        throw new Error('movieId y movieName son requeridos');
      }

      // Publicar en RabbitMQ
      await publishMessage('movie.played', {
        movieId: data.movieId,
        movieName: data.movieName,
        cast: data.cast || [],
        director: data.director || null,
        genre: data.genre || []
      });

      console.log('✓ Evento play publicado en RabbitMQ');

      return { 
        success: true, 
        message: 'Evento play procesado exitosamente',
        data: {
          movieId: data.movieId,
          movieName: data.movieName,
          cast: data.cast || [],
          director: data.director || null,
          genre: data.genre || []
        }
      };
    } catch (error) {
      console.error('✗ Error en handlePlayEvent:', error);
      throw error;
    }
  }
}

module.exports = new EventService();
