const express = require("express");
const http = require("http");
const cors = require("cors");

const {Server} = require("socket.io");

const app = express();
app.use(cors());

const rooms={};
function getRoom(roomId){
    if(!rooms[roomId]) rooms[roomId] = {boardHistory: [], users:{}};
    return rooms[roomId];
}

const server = http.createServer(app);

const io=new Server(server,{
    cors:{
        origin:"*"
    }
});

io.on("connection", (socket)=>{
    console.log("User connected:", socket.id);

    socket.on("disconnect", () => {
        const room=rooms[socket.data.roomId];
        if(room) delete room.users[socket.id];

        socket.to(socket.data.roomId).emit("user-left", socket.id);

        socket.to(socket.data.roomId).emit("user-left-chat", {
            username: socket.data.username
        });

        console.log("User disconnected:", socket.id); });

    socket.on("start-draw", (data)=>{
        socket.to(socket.data.roomId).emit("start-draw", data);
    });

    socket.on("stroke-end", (stroke)=>{
        const room=rooms[socket.data.roomId];
        if(!room) return;
        room.boardHistory.push(stroke);
        socket.to(socket.data.roomId).emit("stroke-add", stroke);
    });

    socket.on("draw", (data)=>{
        socket.to(socket.data.roomId).emit("draw", data);
    });

    socket.on("end-draw", ()=>{
        socket.to(socket.data.roomId).emit("end-draw");
    });
    socket.on("clear-board", ()=>{
        const room=rooms[socket.data.roomId];
        if(room) room.boardHistory =[];

        socket.to(socket.data.roomId).emit("clear-board");
    });
    socket.on("join-room", (data)=>{
        socket.join(data.roomId);
        socket.data.username=data.username;
        socket.data.roomId=data.roomId;

        const room=getRoom(data.roomId);
        room.users[socket.id]=data.username;

        socket.emit("sync-board", room.boardHistory);
        socket.emit("room-users", Object.values(room.users));

        socket.to(data.roomId).emit("user-joined", {
            username:data.username
        });
    });
    socket.on("chat-message", (message)=>{
        const data={
            username: socket.data.username,
            message,
            time: new Date().toLocaleTimeString()
        };
        io.to(socket.data.roomId).emit("chat-message", data);
    });
    socket.on("cursor-move", (data)=>{
        socket.to(socket.data.roomId).emit("cursor-move", {
            socketId:socket.id,
            username:socket.data.username,
            x:data.x,
            y:data.y
        });
    });
    socket.on("sync-board", (boardHistory)=>{
        const room=rooms[socket.data.roomId];
        if(room) room.boardHistory=boardHistory;
        socket.to(socket.data.roomId).emit("sync-board", boardHistory);
    });
    
})
const PORT = 3000;
server.listen(PORT, ()=> {console.log(`Server running on port ${PORT}`);});
