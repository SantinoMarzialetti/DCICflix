const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
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
  }
});

module.exports = mongoose.model('Click', clickSchema);
