const mongoose = require('mongoose');
const taskSchema = new mongoose.Schema({
    
    orderId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Order',
        required:true
    },
    item:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Item',
        required:true
    },
   operationName: {
        type: String,
        required: true
    },
    queuePosition: {
    type: Number,
    default: null
    },
    queuedAt: {
    type: Date,
    default: null
    },
    sequence: {
        type: Number,
        required: true,
        default: 1
    },
    dependsOnTaskIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
    }],
    quantityRequired :{
        type:Number,
        required:true,
    },
    producedQuantity :{
        type: Number,
        default: 0
    },
    defectiveQuantity :{
        type: Number,
        default: 0
    },
     estimatedTimePerUnit: {       //tells estimated time for the item running
            type: Number,
            required: true
    },
    status : {
        type:String,
        enum:['BLOCKED','PENDING','IN_PROGRESS','COMPLETED'],
        default:'PENDING'
    },
    machineId :{
        type:String,
        default:'UNASSIGNED',
    },
    machineName :{
        type:String,
        default:'UNASSIGNED',
    },
    workerName :{
        type:String,
        default:'UNASSIGNED',
    }
},{timestamps:true});

module.exports = mongoose.model('Task',taskSchema);
