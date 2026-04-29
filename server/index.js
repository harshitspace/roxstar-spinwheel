import http from "http";
import app from "./app.js";
import connectDB from "./src/config/db.js";
import "./src/config/redis.js";
import config from "./src/config/env.js";
import logger from "./src/config/logger.js";
import { initSocketServer } from "./src/sockets/index.js";
import autoStartQueue from "./src/queues/autostart.queue.js";
import eliminationQueue from "./src/queues/elimination.queue.js";
import { processAutoStart } from "./src/queues/processors/autostart.processor.js";
import { processElimination } from "./src/queues/processors/elimination.processor.js";


const PORT = config.PORT || 3000;

const startServer = async () => {
    await connectDB();

    const httpServer = http.createServer(app);

    // Initialize Socket.IO on the HTTP server
    initSocketServer(httpServer);

    // Register queue processors
    autoStartQueue.process(processAutoStart);
    eliminationQueue.process(processElimination);

    httpServer.listen(PORT, () => {
        logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    })
}

startServer();