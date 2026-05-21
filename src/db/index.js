import mongoose from "mongoose";
import dns from "node:dns";
import { DB_NAME } from "../constants.js";

// Some systems use a local DNS resolver that rejects SRV lookups for Atlas.
// Force public DNS servers before connecting.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error("MONGODB_URI is not defined in environment variables.");
        }

        const dbName = process.env.MONGODB_DB_NAME || DB_NAME;
        const connectionInstance = await mongoose.connect(uri, {
            dbName,
        });
        console.log(`\nMongoDb connected !! DB HOST: ${connectionInstance.connection.host} DB: ${dbName}`);
    } catch (error) {
        console.log("MONGODB connection error", error);
        process.exit(1);
    }
};

export default connectDB;