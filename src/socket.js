import { Server } from "socket.io";

let io;
// This map links a database User ID to their current active browser Socket ID
const userSocketMap = new Map(); 

export const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN,
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        // When a user connects, they will send their database _id
        const userId = socket.handshake.query.userId;
        
        if (userId) {
            userSocketMap.set(userId, socket.id);
            console.log(`🔌 User ${userId} connected.`);
        }

        socket.on("disconnect", () => {
            if (userId) {
                userSocketMap.delete(userId);
                console.log(`🔴 User ${userId} disconnected.`);
            }
        });
    });
};

// We will use this function inside our controllers to send live alerts
export const emitNotification = (userId, event, data) => {
    const socketId = userSocketMap.get(userId.toString());
    if (socketId && io) {
        io.to(socketId).emit(event, data);
    }
};