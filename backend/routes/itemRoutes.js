const express = require('express');
const router = express.Router();
const { bulkImportItems } = require('../controllers/bulkImportController');

// Import controllers
const { createItem, updateItem, deleteItem, readAllItems } = require('../controllers/itemController');

// Map routes to controllers
router.route('/')
    .get(readAllItems)
    .post(createItem);
router.post('/bulk-import', bulkImportItems);

router.route('/:id')
    .put(updateItem)
    .delete(deleteItem);

module.exports = router;