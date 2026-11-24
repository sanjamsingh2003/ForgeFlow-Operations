const Order = require('../models/Order.model');
const Item = require('../models/Item.model');
const Task = require('../models/Task.model');
const { generateOrderDAG } = require('../services/bomService');                //helps in traversal 
const { addTaskToMachineQueue} = require('../services/schedulerService')   //helps in machine queue
const InventoryMovement = require('../models/InventoryMovement.model')          // records movement stores history 

const processOrderAndGenerateTasks = async (req, res) => {
    try {
        // Postman se yeh 3 cheezein aayengi
        const { orderId, itemId, requiredQuantity } = req.body; 

        if (!orderId || !itemId || !requiredQuantity) {
            return res.status(400).json({ message: 'Missing required fields: orderId, itemId, requiredQuantity' });
        }

        console.log(`🚀 Processing Order: ${orderId} | Item: ${itemId} | Qty: ${requiredQuantity}`);

        // Step 1: Call the DFS BOM Service (Destructure 'tasks' from the returned object)
        const { tasks,materialShortages } = await generateOrderDAG(orderId, itemId, requiredQuantity);

        // Check if no tasks are needed (Sufficient Stock)
        if (tasks.length === 0 && materialShortages.length === 0) {
            return res.status(200).json({ 
                message: 'Sufficient stock available. No manufacturing tasks generated.' 
            });
        }
        if (tasks.length === 0 && materialShortages.length > 0) {
            return res.status(200).json({ 
                message: 'Material Shortage found. No manufacturing tasks generated.' 
            });
        }
        if (tasks.length === 0 && materialShortages.length > 0) {
            return res.status(200).json({
                message: 'Material shortage found. No manufacturing tasks generated.',
                 materialShortages
    });
}
        // Step 2: Atomic Batch Insert (Saara linking already bomService mein ho chuka hai)
        await Task.insertMany(tasks);
        
        console.log(`✅ ${tasks.length} DAG tasks successfully inserted into MongoDB!`);

        return res.status(201).json({ 
            message: materialShortages.length > 0 ?'Manufacturing tasks generated with material shortages':'Manufacturing tasks generated successfully',
            totalTasksGenerated: tasks.length,materialShortages
        });

    } catch (error) {
        console.error('❌ Error in task generation:', error.message);
        return res.status(500).json({ 
            message: 'Internal Server Error', 
            error: error.message 
        });
    }
};
    const completeTask = async(req,res) =>{
        try{
              const taskId = req.params.id;
              const {producedQuantity,defectiveQuantity} = req.body;
        // find task
        
        const task = await Task.findById(taskId).populate({
            path : 'item', 
            populate: {
                path : 'bom.component',
                model :'Item'
            }
        });

        if(!task){
            return res.status(404).json({
                message:"Task not found !!"
            });
        }

        if(task.status === 'COMPLETED'){
            return res.status(400).json({
                message:'Task already completed'
            });                                                         
        }

    if(producedQuantity === undefined || defectiveQuantity === undefined){
        return res.status(400).json({
            message : "Please provide producedQnt and defectiveQnt "
        });
    }
        

    const totalProducedQuantity = producedQuantity + defectiveQuantity;
    for (const bomNode of task.item.bom){
        const consumedQuantity = totalProducedQuantity * bomNode.quantityPerUnit;
       
        if(bomNode.component.currentStock < consumedQuantity){
            return res.status(400).json({
                success : false,
                message :  `Insufficient material: ${bomNode.component.name}. Required: ${consumedQuantity}, Available: ${bomNode.component.currentStock}`
            });
        }
    }
        for (const bomNode of task.item.bom){
        const consumedQuantity = totalProducedQuantity * bomNode.quantityPerUnit;
          
        const updatedComponent = await Item.findByIdAndUpdate(
            bomNode.component._id,
            {
                $inc: {
                    currentStock : -consumedQuantity
                }
            },
                {new : true}
            
        );
        
        updatedComponent.status = updatedComponent.currentStock > 0 ? 'READY':'OUT_OF_STOCK';
        
        
        await updatedComponent.save();
        console.log(`Consumed ${consumedQuantity} of ${bomNode.component.name}`);
    
    
        await InventoryMovement.create({
            item:bomNode.component._id,
            quantity:-consumedQuantity,
            movementType:'CONSUMPTION',
            taskId: task._id
        });
    }
        task.producedQuantity = producedQuantity;
        task.defectiveQuantity = defectiveQuantity;
        task.status = 'COMPLETED';
        await task.save();  

        console.log(`Task Completed :${taskId}`);

    const updatedItem = await Item.findByIdAndUpdate(
        task.item._id,
        {
             $inc: {
                    currentStock : producedQuantity
                }
            },
            {new : true}
    ); 
    updatedItem.status = updatedItem.currentStock > 0 ? 'READY':'OUT_OF_STOCK';
    await updatedItem.save();
    console.log(`Produced ${producedQuantity} of ${task.item.name}`);

         await InventoryMovement.create({
            item:task.item._id,
            quantity:producedQuantity,
            movementType:'PRODUCTION',
            taskId: task._id
        });



        const dependentTasks = await Task.find({
            dependsOnTaskIds: taskId
        });

        for(const dependentTask of dependentTasks){

            const dependencies = await Task.find({
                _id: { $in: dependentTask.dependsOnTaskIds }
            });
            const allDependenciesCompleted = dependencies.every(
                dependency => dependency.status === 'COMPLETED'
            );

             if (allDependenciesCompleted) {
                dependentTask.status = 'PENDING';
                await dependentTask.save();
                await addTaskToMachineQueue(dependentTask._id);
             console.log(` Task Unlocked ${dependentTask._id}`);
             }
        }
        // Automatically complete the order when all its production
        // tasks have been completed.

         const unfinishedTasks = await Task.countDocuments({
            orderId: task.orderId,
            status: { $ne: 'COMPLETED' }
        });

        if (unfinishedTasks === 0) {
            await Order.findByIdAndUpdate(task.orderId, {
                status: 'Completed'
            });
        }
       

        return res.status(200).json({
            message: 'Task completed successfully',
            completedTask : task,
            unlockedTask : dependentTasks
                            .filter(task => task.status === 'PENDING')
                            .map (task => task._id)

        });
              
        }catch(error){
            console.error('Error completing task:', error.message);

        return res.status(500).json({
            message: 'Internal Server Error',
            error: error.message
        });

        }
    };
  
    const getAllTasks = async (req, res) => {
    try {
        const filter = {};

        if (req.query.status) {
            filter.status = req.query.status;
        }

        if (req.query.orderId) {
            filter.orderId = req.query.orderId;
        }

        if (req.query.machineId) {
            filter.machineId = req.query.machineId;
        }

        const tasks = await Task.find(filter)
            .populate('item')
            .populate('orderId');

        return res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};


// Export the main function for your routes
module.exports = { processOrderAndGenerateTasks,completeTask,getAllTasks };