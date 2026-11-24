const Order = require('../models/Order.model');
const Item = require('../models/Item.model');
const Task = require('../models/Task.model'); //  Task model  import kar liya
const InventoryMovement = require('../models/InventoryMovement.model');
const { generateOrderDAG,validateOrderBOM } = require('../services/bomService'); //  Naya DAG function
const { addTaskToMachineQueue } = require('../services/schedulerService');

const createOrder = async(req, res) => {
    try {
        const { clientName, orderedItems,dueDate,alertBeforeDays } = req.body;
        
        if (!clientName || !orderedItems || orderedItems.length === 0 || !dueDate ) {
            return res.status(400).json({
                success: false,
                message: "Please fill every detail such as Client Name ,Items and Due Date"
            });
        }
        
        const validationInventory = {};

    for (const currentItem of orderedItems) {
        await validateOrderBOM(
        currentItem.item,
        currentItem.quantity,
        validationInventory
    );
}

        // Order pehle create karo taaki Mongoose ID (_id) mil sake Tasks ke liye
        const finalOrderId = "ORD" + Date.now();         
        const newOrder = await Order.create({
            clientName,
            orderId: finalOrderId, //  custom string
            orderedItems,
            dueDate,
            alertBeforeDays
        });
        let allMaterialShortages = [];
        let itemsToManufacture = [];
        const virtualInventory = {};
        

        // Inventory check and deductions
        for(let i = 0; i < orderedItems.length; i++) {
            const currentItem = orderedItems[i];
            const actualItem = await Item.findById(currentItem.item);
            
            if(!actualItem) {
                return res.status(404).json({
                    success: false,
                    message: `Item not found : ${currentItem.item}`
                });
            }

            let reservedQuantity = 0;
            let shortageQuantity = 0;

            if (actualItem.currentStock >= currentItem.quantity) {
                reservedQuantity = currentItem.quantity;
            } else {
                reservedQuantity = actualItem.currentStock;
                shortageQuantity = currentItem.quantity - actualItem.currentStock;
            }

           const updatedItem = await Item.findByIdAndUpdate(
             currentItem.item,
             { $inc: { currentStock: -reservedQuantity } },
             { new: true }
            );

    updatedItem.status = updatedItem.currentStock > 0 ? 'READY' : 'OUT_OF_STOCK';
    await updatedItem.save();
            currentItem.reservedQuantity = reservedQuantity;
            
            if (reservedQuantity > 0) {
            await InventoryMovement.create({
            item: currentItem.item,
            quantity: -reservedQuantity,
            movementType: 'CONSUMPTION',
            orderId: newOrder._id
    });
}
            if (shortageQuantity > 0) {
                itemsToManufacture.push({
                    itemId: currentItem.item,
                    shortage: shortageQuantity,
                    name: actualItem.name
                });
                console.log(`Alert: Shortage of ${shortageQuantity} for Item ${actualItem.name}. Triggering Production Task`);
            }
        }

            newOrder.orderedItems = orderedItems;
            await newOrder.save();
        
            if(itemsToManufacture.length > 0) {
            for(const itemToMake of itemsToManufacture) {
                console.log(`Starting BOM explosion for the Order: ${newOrder._id}`);
                
                // Naye function se object destructure karke tasks nikale
                const { tasks,materialShortages } = await generateOrderDAG(newOrder._id, itemToMake.itemId, itemToMake.shortage,virtualInventory);
                allMaterialShortages.push(...(materialShortages || []));
                if (tasks.length > 0) {
                    const insertedTasks = await Task.insertMany(tasks);

                    for(const task of insertedTasks){
                        if (task.status==='PENDING'){
                            await addTaskToMachineQueue(task._id);
                        }
                    }
                    console.log(` ${insertedTasks.length} DAG tasks successfully inserted and queued!`);
                }
            }
        } else {
            console.log("Stock is sufficient. No production tasks needed.");
            newOrder.status = 'Completed';
            await newOrder.save();
        }

        res.status(201).json({
            success: true,
            message: "Dispatch order created, inventory safely updated, and Production DAG generated!",
            data: newOrder,
            materialShortages : allMaterialShortages
        });

    } catch(error) {
        console.error("❌ Order Creation Error:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

const getAllOrders = async (req,res) => {
    try{
        const orders = await Order.find().populate('orderedItems.item')

        return res.status(200).json({
            success : true,
            count:orders.length,
            data : orders
        });

    }catch(error) {
        return res.status(500).json({
            success:false,
            message:"Internal Server Error",
            error : error.message
        });

    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('orderedItems.item');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: order
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};
module.exports = { createOrder,getAllOrders,getOrderById};