const express = require('express');

const router = express.Router();

const { getAllMachines } = require('../controllers/machineController');

router.get('/', getAllMachines);

module.exports = router;