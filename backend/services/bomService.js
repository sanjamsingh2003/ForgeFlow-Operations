const Item = require ('../models/Item.model');
const mongoose = require('mongoose');
// recursive dfs
async function generateOrderDAG(
    orderId,
    itemId,
    requiredQuantity,
    virtualInventory = {},
    materialShortages =[],
    hasMaterialShortages = false
){
    const item = await Item.findById(itemId).populate('bom.component');
// if item is unavailable
if (!item){
    throw new Error(`${itemId} is unavailabe in database`)
}

const itemKey = item._id.toString();

if(virtualInventory[itemKey]===undefined){
    virtualInventory[itemKey] = item.currentStock;
}

const availableStock = virtualInventory[itemKey]; 


const quantityConsumed = Math.min(requiredQuantity,availableStock);

virtualInventory[itemKey] -= quantityConsumed;


let shortageQty = requiredQuantity-quantityConsumed;

console.log("DEBUG ITEM:", item.name);
console.log("DEBUG requiredQuantity:", requiredQuantity);
console.log("DEBUG availableStock:", availableStock);
console.log("DEBUG consumed:", quantityConsumed);
console.log("DEBUG remainingVirtualStock:", virtualInventory[itemKey]);
console.log("DEBUG shortageQty:", shortageQty);

// shortage check
if(shortageQty<=0){
return {
    tasks :[],
    completionTaskIds :[],
    materialShortages,
    hasMaterialShortages
    }
};
if (
    shortageQty > 0 &&
    item.bom.length === 0 &&
    (!item.operations || item.operations.length === 0)
) {
    materialShortages.push({
        itemId: item._id,
        itemName: item.name,
        requiredQuantity,
        availableQuantity: quantityConsumed,
        shortageQuantity: shortageQty
    });

    return {
        tasks: [],
        completionTaskIds: [],
        materialShortages,
        hasMaterialShortages : true
    };
}
let allTasks = [];
let childCompletionTaskIds = [];

if ( item.bom.length > 0){
    for (const bomNode of item.bom){
        const subQty = shortageQty * bomNode.quantityPerUnit;
        const childResult = await generateOrderDAG(
            orderId,
            bomNode.component._id,
            subQty,
            virtualInventory,
            materialShortages,

        );
        allTasks = allTasks.concat(childResult.tasks);
            childCompletionTaskIds = childCompletionTaskIds.concat(childResult.completionTaskIds);
            if (childResult.hasMaterialShortages){
                hasMaterialShortages = true;

            }
        }
    }

    //  2. Process Current Item Operations
    let currentItemTasks = [];
    let previousOperationId = null;

    // Operations sort karo, ya fallback assign karo
 if (item.bom.length > 0 && (!item.operations || item.operations.length === 0)) {
    return {
        tasks: allTasks,
        completionTaskIds: childCompletionTaskIds,
        materialShortages,
        hasMaterialShortages
    };
}

    const operations = item.operations.sort(
    (a, b) => a.sequence - b.sequence
);

    for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const newTaskId = new mongoose.Types.ObjectId(); // In-memory ID generation

        // ✨ The Dependency Magic ✨
        // Pehla operation saare baccho ke khatam hone ka wait karega.
        // Baaki ke operations sirf apne pichle step ka wait karenge.
        let dependencies = [];
        if (i === 0) {
            dependencies = [...childCompletionTaskIds]; 
        } else {
            dependencies = [previousOperationId];
        }

        const taskObj = {
            _id: newTaskId,
            orderId: orderId,
            item: item._id,
            operationName: op.operationName,
            sequence: op.sequence,
            quantityRequired: shortageQty,
            dependsOnTaskIds: dependencies, // Parallel Graph linking!
            machineId: op.machineId || 'UNASSIGNED',
            estimatedTimePerUnit: op.estimatedTimePerUnit,
            status: dependencies.length === 0 && !hasMaterialShortages ? 'PENDING':'BLOCKED'
        };

        currentItemTasks.push(taskObj);
        previousOperationId = newTaskId; // Agle loop ke liye update
    }

    // Is item ke tasks total graph mein add karo
    allTasks = allTasks.concat(currentItemTasks);

    
    // Is branch ka 'completion taskId' is item ka sabse aakhiri operation hoga
    const finalCompletionIds = currentItemTasks.length > 0 
        ? [currentItemTasks[currentItemTasks.length - 1]._id] 
        : childCompletionTaskIds; 

    return {
        tasks: allTasks,
        completionTaskIds: finalCompletionIds,
        materialShortages,
        hasMaterialShortages
    };
}
async function validateOrderBOM(
    itemId,
    requiredQuantity,
    virtualInventory = {}
) {
    const item = await Item.findById(itemId).populate('bom.component');

    if (!item) {
        throw new Error(`${itemId} is unavailable in database`);
    }

    const itemKey = item._id.toString();

    if (virtualInventory[itemKey] === undefined) {
        virtualInventory[itemKey] = item.currentStock;
    }

    const availableStock = virtualInventory[itemKey];
    const consumed = Math.min(requiredQuantity, availableStock);

    virtualInventory[itemKey] -= consumed;

    const shortageQty = requiredQuantity - consumed;

    // Stock enough → branch stops
    if (shortageQty <= 0) {
        return;
    }

   // No BOM + no operations → purchased / terminal item
    if (
        item.bom.length === 0 &&
        (!item.operations || item.operations.length === 0)
    ) {
        return;
    }

   

    // Continue only if shortage exists
    for (const bomNode of item.bom) {
        const childRequiredQty =
            shortageQty * bomNode.quantityPerUnit;

        await validateOrderBOM(
            bomNode.component._id,
            childRequiredQty,
            virtualInventory
        );
    }
}

module.exports = { generateOrderDAG,validateOrderBOM };
