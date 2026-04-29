import app from "./app.js";
import connectDB from "./src/config/db.js";
import "./src/config/redis.js";
import logger from "./src/config/logger.js";


const PORT = process.env.PORT || 3000;

const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    })
}

startServer();