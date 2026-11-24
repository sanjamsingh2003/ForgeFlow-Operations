const express = require('express');
const router = express.Router();
//import function
const {createOrder,getAllOrders,getOrderById} = require('../controllers/orderController')
//setting routes
router.get('/',getAllOrders);
router.get('/:id',getOrderById);
router.route('/').post(createOrder)
module.exports = router;