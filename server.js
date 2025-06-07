const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

app.use(express.static("public"));

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = {};

io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on("join", ({ roomId, username }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, username });

    socket.to(roomId).emit("user-joined", socket.id);

    const otherUsers = rooms[roomId].filter(user => user.id !== socket.id).map(user => user.id);
    socket.emit("all-users", otherUsers);
  });

  socket.on("signal", ({ to, signal }) => {
    io.to(to).emit("signal", { from: socket.id, signal });
  });

  socket.on("chat-message", ({ roomId, username, message }) => {
    io.to(roomId).emit("chat-message", { username, message });
  });

  socket.on("reaction", ({ roomId, emoji }) => {
    socket.to(roomId).emit("reaction", { from: socket.id, emoji });
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(user => user.id !== socket.id);
      socket.to(roomId).emit("user-disconnected", socket.id);
      if (rooms[roomId].length === 0) delete rooms[roomId];
    }
  });
});

server.listen(3000, () => console.log("🚀 Server running on port 3000"));
