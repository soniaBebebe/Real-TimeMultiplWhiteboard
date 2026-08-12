const express = require("express");
const http = require("http");
const cors = require("cors");

const {Server} = require("socket.io");

const MAX_NAME_LENGTH=32;
const MAX_MESSAGE_LENGTH=1000;
const MAX_POINTS=20000;
const SHAPE_TYPES=new Set(['rect', 'line','circle','arrow']);

function num(value){
    const n = Number(value);
    return Number.isFinite(n) ? n :0;
}

function safeSize(value){
    const n=Number(value);
    if(!Number.isFinite(n)) return 5;
    return Math.min(100, Math.max(1,n));
}

function safeColor(value){
    if(typeof value !=="string") return "#000000";
    return /^#[0-9a-fA-F]{3,8}$/.test(value) || /^[a-zA-Z]{1,20}$/.test(value)
    ? value
    : "#000000";
}

function safePoint(point){
    if(!point || typeof point !=="object") return null;
    return {x: num(point.x), y: num(point.y)};
}

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
        const roomId=socket.data.roomId;
        if(!roomId) return;
        const payload=data||{};
        const point = safePoint(payload);
        if(!point) return;
        socket.to(roomId).emit("start-draw", {
            socketId:socket.id,
            x: point.x,
            y: point.y,
            color: safeColor(payload.color),
            brushSize: safeSize(payload.brushSize)
        });
    });

    socket.on("stroke-end", (stroke)=>{
        const room=rooms[socket.data.roomId];
        if(!room) return;
        room.boardHistory.push(stroke);
        socket.to(socket.data.roomId).emit("stroke-add", stroke);
    });

    socket.on("draw", (data)=>{
        const roomId=socket.data.roomId;
        if(!roomId) return;
        const payload=data||{};
        const point = safePoint(payload);
        if(!point) return;
        socket.to(roomId).emit("draw", {
            socketId: socket.id,
            x: point.x,
            y: point.y
        });
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
        const payload=data || {};
        const username=String(payload.username||"").trim().slice(0,MAX_NAME_LENGTH);
        const roomId=String(payload.roomId||"").trim().slice(0,MAX_NAME_LENGTH);
        if(!username||!roomId) return;
        socket.join(roomId);
        socket.data.username=username;
        socket.data.roomId=roomId;

        const room=getRoom(roomId);
        room.users[socket.id]=username;

        socket.emit("sync-board", room.boardHistory);
        io.to(roomId).emit("room-users", Object.values(room.users));

        socket.to(roomId).emit("user-joined", {
            username
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
    
    socket.on("shape-preview", (data) =>{
        socket.to(socket.data.roomId).emit("shape-preview", data);
    });
})
const PORT = 3000;
server.listen(PORT, ()=> {console.log(`Server running on port ${PORT}`);});
