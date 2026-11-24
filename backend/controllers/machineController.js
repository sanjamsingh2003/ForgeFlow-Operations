const Machine = require('../models/Machine.model');

const getAllMachines = async (req, res) => {
    try {
        const machines = await Machine.find();

        return res.status(200).json({
            success: true,
            count: machines.length,
            data: machines
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

module.exports = { getAllMachines };