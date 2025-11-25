const mongoose = require('mongoose');

const calificationSchema = new mongoose.Schema({
  movieId: {
    type: String,
    required: true,
    index: true
  },
  movieName: {
    type: String,
    required: true
  },
  cast: {
    type: [String],
    default: []
  },
  director: {
    type: String,
    default: null
  },
  genre: {
    type: [String],
    default: []
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    validate: {
      validator: (v) => v % 1 === 0,
      message: 'La calificación debe ser un número entero'
    }
  },
});

// Middleware para actualizar updatedAt
calificationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Calification', calificationSchema);
