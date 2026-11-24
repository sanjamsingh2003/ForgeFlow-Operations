const mongoose = require ('mongoose');
const machineSchema = new mongoose.Schema({
    machineId: {
        type : String,
        required : true,
        unique : true,
    },
    machineName: {
        type:String,
        required : true,
        trim : true
    },
    workerName: {
        type:String,
        required : true,
        trim : true

    },
    status: {
       type:String,
       enum :['AVAILABLE','IN_USE','STOPPED','BROKE'],
       default : 'AVAILABLE'
    }

},{timestamps : true});


module.exports = mongoose.model('Machine', machineSchema);