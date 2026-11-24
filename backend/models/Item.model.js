const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { 
        type: String,
        required: true,
        trim: true 
    },

    sku: { 
        type: String,
         unique: true,
          sparse: true 
        }, // Factory barcode ya code ke liye
    category: {
        type: String,
        required: true,
        trim: true  
        },
    unit: { 
        type: String,
         required: true,
          default: "pcs" 
        }, // kg, meter, pcs
    itemNature: {
    type: String,
    enum: [
        "RAW_MATERIAL",
        "PROCESSED_ITEM",
        "COMPONENT",
        "SUB_ASSEMBLY",
        "FINISHED_PRODUCT"
    ],
    required: true
    },    
    currentStock: { 
        type: Number,
         required: true,
          default: 0 
        },
    minimumStock: {
         type: Number,
          default: 10 
        }, // Alert ke liye jab stock low ho
        
    costPerUnit: {
    type: Number,
    default: null,
    validate: {
        validator: function(value) {
            
            if (this.itemNature === "RAW_MATERIAL") {
                return value !== null && value !== undefined;
            }
                return value === null || value === undefined;
        },

        message: "Cost per unit is required only for raw materials."
    }
},
    status: { 
        type: String, 
        enum: ["WIP", "ASSEMBLED", "READY", "OUT_OF_STOCK"], 
        default: "OUT_OF_STOCK" 
    },
    bom: [{
        component : {
            type:mongoose.Schema.Types.ObjectId,
            ref:'Item',
            required:true
        },
        quantityPerUnit : {
            type: Number,
            required : true,
        }
    }],
    operations: [{
        sequence: {        // prioritzing steps
            type: Number, 
            required: true 
        },
        operationName: {  // cutting welding etc.
            type: String, 
            required: true 
        },
        machineId: {       // id 
            type: String, 
            required: true 
        },
        estimatedTimePerUnit: {       //tells estimated time for the item running
            type: Number,
            required: true
        }

    }]

    
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);