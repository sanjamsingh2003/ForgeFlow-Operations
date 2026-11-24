
const Item = require('../models/Item.model');
const Machine = require('../models/Machine.model');

const VALID_NATURES = [
    'RAW_MATERIAL',
    'PROCESSED_ITEM',
    'COMPONENT',
    'SUB_ASSEMBLY',
    'FINISHED_PRODUCT'
];

const bulkImportItems = async (req, res) => {
    try {
        const { items = [], bom = [], operations = [] } = req.body || {};

        // 1. Basic validation
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Items array is required.'
            });
        }

        if (!Array.isArray(bom) || !Array.isArray(operations)) {
            return res.status(400).json({
                success: false,
                message: 'BOM and Operations must be arrays.'
            });
        }

        const skuSet = new Set();

        for (const item of items) {
            if (
                !item.sku ||
                !item.name ||
                !item.category ||
                !item.unit
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Every item needs SKU, name, category and unit.'
                });
            }

            item.sku = String(item.sku).trim();

            if (!item.sku) {
                return res.status(400).json({
                    success: false,
                    message: 'SKU cannot be empty.'
                });
            }

            if (!VALID_NATURES.includes(item.itemNature)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid item nature for ${item.sku}.`
                });
            }

            if (skuSet.has(item.sku)) {
                return res.status(400).json({
                    success: false,
                    message: `Duplicate SKU in file: ${item.sku}`
                });
            }

            skuSet.add(item.sku);

            if (
                item.openingStock !== undefined &&
                (
                    !Number.isFinite(Number(item.openingStock)) ||
                    Number(item.openingStock) < 0
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid opening stock for ${item.sku}.`
                });
            }

            if (
                item.minimumStock !== undefined &&
                (
                    !Number.isFinite(Number(item.minimumStock)) ||
                    Number(item.minimumStock) < 0
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid minimum stock for ${item.sku}.`
                });
            }

            // Only raw materials have a cost per unit.
            if (
                item.itemNature === 'RAW_MATERIAL' &&
                (
                    item.costPerUnit === null ||
                    item.costPerUnit === undefined ||
                    item.costPerUnit === '' ||
                    !Number.isFinite(Number(item.costPerUnit)) ||
                    Number(item.costPerUnit) < 0
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Valid costPerUnit is required for ${item.sku}.`
                });
            }
        }

        // 2. Collect all referenced SKUs.
        // They may be new items or items already in the database.
        const referencedSkus = new Set();

        for (const row of bom) {
            if (row.parentSku) referencedSkus.add(row.parentSku);
            if (row.componentSku) referencedSkus.add(row.componentSku);
        }

        for (const row of operations) {
            if (row.itemSku) referencedSkus.add(row.itemSku);
        }

        const allRequiredSkus = new Set([
            ...skuSet,
            ...referencedSkus
        ]);

        const existingItems = await Item.find({
            sku: { $in: [...allRequiredSkus] }
        });

        const existingSkuSet = new Set(
            existingItems.map(item => item.sku)
        );

        const availableSkus = new Set([
            ...skuSet,
            ...existingSkuSet
        ]);

        // 3. Validate BOM references
        for (const row of bom) {
            if (
                !row.parentSku ||
                !row.componentSku ||
                !availableSkus.has(row.parentSku) ||
                !availableSkus.has(row.componentSku)
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid BOM reference: ${row.parentSku} -> ${row.componentSku}`
                });
            }

            if (
                row.parentSku === row.componentSku ||
                !Number.isFinite(Number(row.quantityPerUnit)) ||
                Number(row.quantityPerUnit) <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid BOM quantity or self-reference for ${row.parentSku}.`
                });
            }
        }

        // 4. Validate machines
        for (const operation of operations) {
            if (!operation.machineId) {
                return res.status(400).json({
                    success: false,
                    message: 'Every operation needs a machine ID.'
                });
            }
        }

        const machineIds = [
            ...new Set(operations.map(o => o.machineId))
        ];

        const machines = await Machine.find({
            machineId: { $in: machineIds }
        });

        const validMachines = new Set(
            machines.map(machine => machine.machineId)
        );

        for (const operation of operations) {
            if (
                !operation.itemSku ||
                !availableSkus.has(operation.itemSku) ||
                !operation.operationName ||
                !Number.isInteger(Number(operation.sequence)) ||
                Number(operation.sequence) < 1 ||
                !Number.isFinite(Number(operation.estimatedTimePerUnit)) ||
                Number(operation.estimatedTimePerUnit) <= 0 ||
                !validMachines.has(operation.machineId)
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid operation or machine for ${operation.itemSku}.`
                });
            }
        }

        // 5. Prepare a map of existing items.
        const itemMap = new Map();

        for (const existing of existingItems) {
            itemMap.set(existing.sku, existing);
        }

        // 6. Create or update submitted items.
        for (const data of items) {
            let item = itemMap.get(data.sku);

            const itemData = {
                name: data.name,
                category: data.category,
                unit: data.unit,
                itemNature: data.itemNature,
                minimumStock: Number(data.minimumStock ?? 10),

                // Raw materials have a cost.
                // All other item types must have null.
                costPerUnit:
                    data.itemNature === 'RAW_MATERIAL'
                        ? Number(data.costPerUnit)
                        : null
            };

            if (item) {
                // Update existing item without changing its live stock.
                Object.assign(item, itemData);
            } else {
                // Opening stock applies only to newly created items.
                item = new Item({
                    sku: data.sku,
                    ...itemData,
                    currentStock: Number(data.openingStock ?? 0)
                });
            }

            // Document save runs the original schema validators correctly.
            await item.save();

            itemMap.set(data.sku, item);
        }

        // 7. Prepare BOM relationships
        const bomMap = new Map();

        for (const row of bom) {
            if (!bomMap.has(row.parentSku)) {
                bomMap.set(row.parentSku, []);
            }

            bomMap.get(row.parentSku).push({
                component: itemMap.get(row.componentSku)._id,
                quantityPerUnit: Number(row.quantityPerUnit)
            });
        }

        // 8. Prepare operations
        const operationMap = new Map();

        for (const row of operations) {
            if (!operationMap.has(row.itemSku)) {
                operationMap.set(row.itemSku, []);
            }

            operationMap.get(row.itemSku).push({
                sequence: Number(row.sequence),
                operationName: row.operationName.trim(),
                machineId: row.machineId,
                estimatedTimePerUnit: Number(row.estimatedTimePerUnit)
            });
        }

        // 9. Update BOM and operations.
        // Existing data remains unchanged when no replacement is supplied.
        for (const data of items) {
            const item = itemMap.get(data.sku);

            let changed = false;

            if (bomMap.has(data.sku)) {
                item.bom = bomMap.get(data.sku);
                changed = true;
            }

            if (operationMap.has(data.sku)) {
                item.operations = operationMap
                    .get(data.sku)
                    .sort((a, b) => a.sequence - b.sequence);

                changed = true;
            }

            if (changed) {
                // Use document save rather than update validators.
                await item.save();
            }
        }

        // 10. Success response
        return res.status(200).json({
            success: true,
            message: 'Bulk import completed successfully.',
            summary: {
                submitted: items.length,
                createdOrUpdated: items.length,
                bomRelationships: bom.length,
                operations: operations.length,
                existingStockPreserved: true
            }
        });

    } catch (error) {
        console.error('Bulk import error:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Bulk import failed.'
        });
    }
};

module.exports = { bulkImportItems };
