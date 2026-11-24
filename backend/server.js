//importing core dependencies
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const itemRoutes = require('./routes/itemRoutes');
const orderRoutes = require('./routes/orderRoutes');
const taskRoutes = require('./routes/taskRoutes');
const machineRoutes = require('./routes/machineRoutes');
const inventoryMovementRoutes = require('./routes/inventoryMovementRoutes');
const dns = require('dns');


dns.setServers([
    '8.8.8.8',
    '1.1.1.1'
])


//initialising express
const app = express();

//enviroment variables
const PORT = process.env.port||5000;
const MONGO_URI = process.env.MONGO_URI;

//Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/items', itemRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/machines',machineRoutes);
app.use('/api/inventory-movements',inventoryMovementRoutes);
// Database Connection
const connectDB = async()=>{
    try{
        //attempt to connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB Connected Successfully to FactoryDB!');
    } catch (error) {
        console.error('❌ MongoDB Connection FAILED: ', error.message);
        // Server Crashes if Database Connection fails
        process.exit(1);
    }
};
//Executing the Connection
connectDB();

//Starting Express Server 
app.listen(PORT,() =>{
    console.log(`Factory server is LIVE on port ${PORT}`);
});

