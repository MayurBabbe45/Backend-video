import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";
import http from "http"; // 🚨 Import Node's native HTTP module
import { initializeSocket } from "./socket.js";

dotenv.config({
    path: "./.env"
});

// 1. Create a raw HTTP server using your Express app
const server = http.createServer(app);

// 2. Initialize Socket.io and attach it to the server
const io = initializeSocket(server);

// 3. Inject the io instance into the Express app so controllers can access it!
app.set("io", io);

// MongoDB connection + server start
connectDB()
.then(() => {
    // 🚨 IMPORTANT: Call server.listen here, NOT app.listen!
    server.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port : ${process.env.PORT || 8000}`);
    });
    
    app.on("error", (error) => {
        console.log("Err: ", error);
        throw error;
    });
})
.catch((err) => {
    console.log("MONGO DB connection error !!", err);
});