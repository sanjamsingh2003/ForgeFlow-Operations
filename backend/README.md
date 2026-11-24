# ForgeFlow Backend

The ForgeFlow backend provides the REST API and business logic for inventory management, customer orders, BOM-based production planning, task dependencies, machine allocation, and inventory movement tracking.

## Technology Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- dotenv

## Architecture

```text
backend/
|
|-- controllers/
|   |-- itemController.js
|   |-- orderController.js
|   |-- taskController.js
|   |-- machineController.js
|   |-- inventoryMovementController.js
|
|-- models/
|   |-- Item.model.js
|   |-- Order.model.js
|   |-- Task.model.js
|   |-- Machine.model.js
|   |-- InventoryMovement.model.js
|
|-- routes/
|   |-- itemRoutes.js
|   |-- orderRoutes.js
|   |-- taskRoutes.js
|   |-- machineRoutes.js
|   |-- inventoryMovementRoutes.js
|
|-- services/
|   |-- bomService.js
|   |-- schedulerService.js
|
|-- server.js
|-- package.json
```

## Core Backend Responsibilities

### 1. Inventory Management

- Maintain item and stock information.
- Support item classification.
- Update inventory through relevant operations.
- Track inventory movements.

### 2. Order Processing

- Handle customer orders.
- Check finished-product stock availability.
- Calculate production requirements.
- Identify shortages requiring further production or material procurement.

### 3. Bill of Materials (BOM)

The backend supports multi-level BOM relationships.

A typical manufacturing structure can be represented as:

```text
Finished Product
       |
       v
Sub-Assembly
       |
       v
Component
       |
       v
Raw Material
```

The BOM service traverses these relationships to identify the materials and intermediate items required for production.

### 4. Production Task Generation

- Generate production tasks from manufacturing requirements.
- Represent task dependencies.
- Support parallel production branches.
- Identify tasks waiting for dependencies or material availability.

### 5. Machine and Worker Allocation

- Associate production tasks with machines and workers.
- Maintain machine status.
- Manage machine queues.
- Track queued production workload.

### 6. Task Lifecycle

The current practical task lifecycle is:

```text
BLOCKED → PENDING → COMPLETED
```

A task can become eligible for production when its dependencies are complete and its required materials are available.

The presence of an `IN_PROGRESS` schema state does not imply that a complete task-start workflow is implemented.

### 7. Task Completion and Inventory Movements

Task completion involves:

1. Recording production quantities.
2. Recording defective quantities.
3. Consuming required component stock.
4. Adding good production to output stock.
5. Recording corresponding inventory movements.
6. Evaluating dependent tasks.
7. Unlocking eligible tasks and updating queues.

## API Overview

The backend exposes REST endpoints for the following resources:

| Resource | Purpose |
|---|---|
| Items | Inventory and item management |
| Orders | Customer order retrieval and management |
| Tasks | Production task tracking and completion |
| Machines | Machine information and queues |
| Inventory Movements | Stock movement history |

Local API base URL:

```text
http://localhost:5000
```

The implemented routes are defined in the `routes/` directory.

## Installation and Setup

### Prerequisites

- Node.js
- npm
- MongoDB

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a `.env` file in the backend directory:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
```

Use a development database and keep credentials private.

### Run in development mode

```bash
npm run dev
```

### Run normally

```bash
npm start
```

## Important Engineering Considerations

The following areas require further hardening before production deployment:

- Authentication and authorisation.
- Input validation and stricter quantity constraints.
- Database transactions and atomic inventory updates.
- Concurrency protection for stock allocation.
- Automated integration and regression testing.
- Production deployment security.

## Scope

The backend focuses on the core manufacturing workflow: inventory, order planning, multi-level BOM traversal, production dependencies, machine allocation, task completion, and stock movement history.

Advanced procurement, accounting, workforce attendance, and advanced scheduling are outside the current MVP scope.

---

**ForgeFlow Backend — Node.js, Express.js, and MongoDB.**