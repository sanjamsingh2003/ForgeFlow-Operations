const express = require('express');
const router = express.Router();

const {getAllInventoryMovements} = require('../controllers/inventoryMovementController');

router.get('/',getAllInventoryMovements);

module.exports = router;