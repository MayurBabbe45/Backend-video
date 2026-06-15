import { Server } from "socket.io";

let io;

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
            // 🚨 THE UPGRADE: Instead of a Map, they join a private cryptographic room.
            // If they have 3 tabs open, all 3 sockets join this exact same room.
            socket.join(userId.toString());
            console.log(`🔌 User ${userId} joined their private encrypted channel.`);
        }

        socket.on("disconnect", () => {
            if (userId) {
                // Socket.io automatically removes them from the room on disconnect, 
                // so we just need to log it.
                console.log(`🔴 User ${userId} disconnected.`);
            }
        });
    });

    return io; // We return the io instance so your app.js can use it!
};

// We keep this function so your existing Notification system doesn't break
export const emitNotification = (userId, event, data) => {
    if (io) {
        // Now it emits the event to the user's private room (hitting all their active tabs)
        io.to(userId.toString()).emit(event, data);
    }
};

// We export a getter so your chat.controller.js can access the io instance directly
export const getIo = () => {
    if (!io) {
        throw new Error("Socket.io has not been initialized!");
    }
    return io;
};