const mongoose = require('mongoose');

const inventoryMomentSchema = new mongoose.Schema({

 item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: true
    },

    quantity: {
        type: Number,
        required: true
    },

    movementType: {
        type: String,
        enum: ['CONSUMPTION', 'PRODUCTION'],
        required: true
    },

    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: null
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default : null
    }


},{timestamps :true});

module.exports = mongoose.model('InventoryMovement',inventoryMomentSchema);