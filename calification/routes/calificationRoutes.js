const express = require('express');
const router = express.Router();
const eventService = require('../services/eventService');

// POST - Procesar evento (click, calification, play)
router.post('/', async (req, res) => {
  try {
    const { type, data } = req.body;

    // Validación
    if (!type || !data) {
      return res.status(400).json({
        error: 'Los campos "type" y "data" son obligatorios',
      });
    }

    const result = await eventService.processEvent(type, data);

    res.status(201).json({
      success: true,
      message: `Evento ${type} procesado exitosamente`,
      data: result.data
    });
  } catch (error) {
    console.error('✗ Error en POST /:', error);
    res.status(400).json({
      error: error.message || 'Error al procesar el evento'
    });
  }
});

module.exports = router;
