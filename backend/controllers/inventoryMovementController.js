const InventoryMovement = require('../models/InventoryMovement.model');

const getAllInventoryMovements = async (req,res) => {
    try{
        const movements = await InventoryMovement.find()
                .populate('item')
                .populate('taskId')
                .populate('orderId')
                .sort({createdAt : -1});

            return res.status(200).json({
                success : true,
                count : movements.length,
                data : movements
            });    
    }catch(error){
        return res.status(500).json({
            success : false,
            message : "Internal Server Error",
            error : error.message
        });

    }
};
module.exports = {getAllInventoryMovements};