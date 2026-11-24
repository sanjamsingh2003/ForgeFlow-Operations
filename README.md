# ForgeFlow — Manufacturing Operations Management System

ForgeFlow is a MERN-stack manufacturing operations management system designed to bring inventory, order planning, production workflows, and shop-floor visibility into one platform.

It aims to help manufacturing businesses understand material availability, identify production bottlenecks, manage dependencies between manufacturing operations, and monitor inventory movements.

## Problem Statement

Manufacturing operations often depend on disconnected inventory records, manual production planning, and limited visibility into work in progress.

This makes it difficult to:
- Determine whether customer orders can be fulfilled from existing stock.
- Identify shortages across multi-level Bills of Materials (BOM).
- Understand dependencies between manufacturing operations.
- Track production tasks across machines.
- Maintain a clear history of inventory movements.

ForgeFlow addresses these challenges through an integrated inventory and production workflow.

## Key Features

### Dashboard
- Operational overview of orders and production.
- Visibility into material shortages and blocked work.
- Important inventory and production indicators.

### Order Management
- Customer order management.
- Inventory-aware production planning.
- Order-level production visibility.

### Inventory Management
- Centralised item and stock management.
- Product categories and item classifications.
- Stock availability and material shortage visibility.
- Inventory movement history.

### BOM and Production Planning
- Multi-level Bill of Materials support.
- Component and sub-assembly relationships.
- Inventory-aware shortage calculation.
- Dependency-aware production task generation.

### Production Management
- Production task tracking.
- Task dependency management.
- Machine and worker allocation.
- Machine queue visibility.
- Production completion and inventory updates.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript |
| UI | CSS, Lucide React |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| API | REST |
| Development | Git, GitHub, VS Code |

## System Architecture

```text
              React Frontend
                    |
                    | REST API
                    |
              Express Backend
                    |
          -----------------------
          |          |          |
       Orders    Inventory   Production
          |          |          |
          -----------------------
                    |
                 MongoDB
```

## Project Structure

```text
ForgeFlow-Operations/
|
|-- backend/
|   |-- controllers/
|   |-- models/
|   |-- routes/
|   |-- services/
|   |-- server.js
|   |-- package.json
|
|-- src/
|   |-- components/
|   |-- pages/
|   |-- api.js
|   |-- App.jsx
|   |-- Shell.jsx
|
|-- package.json
|-- vite.config.js
|-- .env.example
|-- README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- MongoDB instance
- Git

### 1. Clone the repository

```bash
git clone https://github.com/sanjamsingh2003/ForgeFlow-Operations.git
cd ForgeFlow-Operations
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd backend
npm install
```

### 4. Configure environment variables

Create a `.env` file inside the `backend` directory.

Add your MongoDB connection string:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
```

Use your own development database. Never commit environment files or credentials.

### 5. Start the backend

From the `backend` directory:

```bash
npm run dev
```

### 6. Start the frontend

Open another terminal in the project root:

```bash
npm run dev
```

The Vite development server runs at:

```text
http://localhost:5173
```

The frontend development proxy is configured to communicate with the backend at port `5000`.

## Engineering Concepts

ForgeFlow incorporates several important backend and manufacturing concepts:

- Multi-level Bill of Materials traversal.
- Shared inventory planning.
- Dependency graphs for production tasks.
- Machine queue management.
- Inventory consumption and production movements.
- Stock availability and shortage analysis.

These concepts connect manufacturing data with operational workflows.

## Current Scope and Limitations

ForgeFlow is an MVP and is still subject to further development and hardening.

Areas requiring additional work include:
- Authentication and role-based authorisation.
- Production API security and deployment hardening.
- Database transaction and concurrency safeguards.
- Further validation and automated testing.
- Advanced manufacturing analytics and reporting.

The application should be used with development or test data until the required security and operational safeguards are implemented.

## Project Status

ForgeFlow is being developed as a full-stack engineering project, with emphasis on backend business logic, inventory management, manufacturing dependencies, and production visibility.

---

**Built with React, Node.js, Express, and MongoDB.**