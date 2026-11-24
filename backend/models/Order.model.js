const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    clientName: {
        type: String,
        required: true,
        trim:true
    },
    orderId: {
        type: String,
        unique: true,
        required:true,
    },
    orderedItems: [{
        item:{
         type: mongoose.Schema.Types.ObjectId,
         ref:'Item',
         required: true, 
        },
        quantity: {
        type: Number,
        required: true,
        },
        reservedQuantity: {
        type: Number,
        default: 0,
        },

    }],
        dueDate: {
        type: Date,
        required: true
        },
        alertBeforeDays: {
        type: Number,
        enum: [2, 5, 7],
        default: 2
        },
        
        status: {
        type:String,
        enum:["Pending","Processing","Completed","Cancelled"],
        default:"Pending"
    }
},{timestamps:true});
module.exports = mongoose.model('Order', orderSchema);