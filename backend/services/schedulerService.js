const Task = require('../models/Task.model');
const Machine = require('../models/Machine.model');

const addTaskToMachineQueue = async(taskId) =>{
const task = await Task.findById(taskId);

if(!task){
    throw new Error('Task not found !!');
}

if (task.status !=='PENDING'){
    return task;
}
if(!task.machineId || task.machineId ==='UNASSIGNED'){
    throw new Error('Task is not assigned to any machine !!')
}
const machine = await Machine.findOne({ machineId: task.machineId });

if (!machine) {
    throw new Error(`Machine ${task.machineId} not found !!`);
}

task.machineName = machine.machineName;
task.workerName = machine.workerName;
//finding machine with id so we can queue upcoming task

const lastQueuedTask = await Task.findOne({
        machineId: task.machineId,
        status: { $in: ['PENDING', 'IN_PROGRESS'] },
        queuePosition: { $ne: null }                //we are checking the already existing queue so we know where to position what we have  
    }).sort({ queuePosition: -1 }); // arranges in high to low

 const nextPosition = lastQueuedTask ? lastQueuedTask.queuePosition + 1 : 1;      // ya toh pehle pe ya jo bhi current hai uss se nxt

    task.queuePosition = nextPosition;
    task.queuedAt = new Date();

    await task.save();

    return task;
};

module.exports = { addTaskToMachineQueue };

