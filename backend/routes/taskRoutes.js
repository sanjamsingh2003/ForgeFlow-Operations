const express = require('express');
const router = express.Router();
const { completeTask,getAllTasks } = require('../controllers/taskController');

router.get('/', getAllTasks);

router.post('/complete/:id', completeTask);

module.exports = router;