"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const db_1 = require("./config/db");
const runner_1 = require("./agents/runner");
const migrate_1 = require("./migrate");
const port = process.env.PORT || 4000;
const agentRunner = new runner_1.AgentRunner();
async function startServer() {
    try {
        // 1. Connect to database
        await (0, db_1.connect)();
        console.log('✓ Connected to database');
        // 2. Run migrations automatically
        console.log('');
        await (0, migrate_1.runMigrations)(false); // false = don't create new connection
        console.log('');
        // 3. Start the Express API server
        app_1.default.listen(port, () => console.log(`✓ Backend API listening on ${port}`));
        // 4. Start the agent runner (runs agents every 5 minutes)
        const runAgents = process.env.RUN_AGENTS !== 'false'; // Default: true
        if (runAgents) {
            const agentInterval = parseInt(process.env.AGENT_INTERVAL_MINUTES || '5');
            await agentRunner.start(agentInterval);
        }
        else {
            console.log('⚠️  Agent runner disabled (set RUN_AGENTS=true to enable)');
        }
        console.log('');
        console.log('====================================');
        console.log('🚀 Backend is ready!');
        console.log('====================================');
        console.log(`📡 API: http://localhost:${port}`);
        console.log(`📚 Docs: http://localhost:${port}/api-docs`);
        console.log('====================================');
        console.log('');
    }
    catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}
startServer();
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await agentRunner.stop();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\nShutting down server...');
    await agentRunner.stop();
    process.exit(0);
});
