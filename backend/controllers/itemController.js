const Item = require('../models/Item.model');
const Task = require('../models/Task.model');
const { addTaskToMachineQueue } = require('../services/schedulerService');

const createItem = async (req,res) => {
    try{
        const newItem = await Item.create(req.body);
        res.status(201).json({
            success : true,
            message :"Item added to inventory!",
            data:newItem
        });
    }catch(error){
        res.status(400).json({
            success : false,
            message :error.message,
            
        });
    }

};

const readAllItems = async (req,res) => {
    try{
        const items = await Item.find();
        res.status(200).json({
            success : true,
            count :items.length,
            data:items
        });
    }catch(error){
        res.status(500).json({
            success : false,
            message :"Server Error",
            error : error.message
        });
    }

};
const updateItem = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found",
            });
        }

        // Raw material requires cost per unit
        if (
            req.body.itemNature === "RAW_MATERIAL" &&
            (req.body.costPerUnit === undefined ||
             req.body.costPerUnit === null)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill Cost Per Unit for Raw Material."
            });
        }

        // Remove old cost when item is no longer raw material
        if (
            req.body.itemNature &&
            req.body.itemNature !== "RAW_MATERIAL"
        ) {
            req.body.costPerUnit = null;
        }

        Object.assign(item, req.body);
        item.status = item.currentStock > 0 ? "READY" : "OUT_OF_STOCK";
        await item.save();

        // Unblock production tasks if newly available stock can satisfy them
if (
    item.itemNature === "RAW_MATERIAL" &&
    item.currentStock > 0
) {
    const blockedTasks = await Task.find({
        status: "BLOCKED"
    }).populate("item");

    for (const task of blockedTasks) {
        if (!task.item || !task.item.bom) continue;

        const requiredMaterial = task.item.bom.find(
            component =>
                component.component.toString() === item._id.toString()
        );

        if (!requiredMaterial) continue;

        const requiredStock =
            task.quantityRequired * requiredMaterial.quantityPerUnit;

        if (item.currentStock >= requiredStock) {
            const dependencies = await Task.find({
                _id: { $in: task.dependsOnTaskIds}
            });
            const allDependenciesCompleted = dependencies.every(
                dependency => dependency.status === "COMPLETED"
            );
            if(allDependenciesCompleted){
            task.status = "PENDING";
            await task.save();

            await addTaskToMachineQueue(task._id);
            }
        }
    }
}

        res.status(200).json({
            success: true,
            message: "Item updated!",
            data: item
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
const deleteItem = async (req,res) => {
    try{
        const deletedItem = await Item.findByIdAndDelete(req.params.id);
        if(!deletedItem){
            return res.status(404).json({
            success : false,
            message :"Item not found",
            });
        }
  res.status(200).json({
    success:true,
    message:"Item Deleted from inventory"
  })
    }catch(error){
        res.status(500).json({
        success : false,
        message :"Server Error",
        error : error.message
    });

    }    

};
module.exports = {createItem,readAllItems,updateItem,deleteItem};