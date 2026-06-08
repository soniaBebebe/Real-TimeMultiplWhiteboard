const express = require("express");
const http = require("http");
const cors = require("cors");

const {Server} = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io=new Server(server,{
    cors:{
        origin:"*"
    }
});

io.on("connection", (socket)=>{
    console.log("User connected:", socket.id);

    socket.on("disconnect", () => { console.log("User disconnected:", socket.id); });

    socket.on("start-draw", (data)=>{
        socket.to(socket.data.roomId).emit("start-draw", data);
    });

    socket.on("draw", (data)=>{
        socket.to(socket.data.roomId).emit("draw", data);
    });

    socket.on("end-draw", ()=>{
        socket.to(socket.data.roomId).emit("end-draw");
    });
    socket.on("clear-board", ()=>{
        socket.to(socket.data.roomId).emit("clear-board");
    });
    socket.on("join-rom", (data)=>{
        socket.join(data.roomId);
        socket.data.username=data.username;
        socket.data.roomId=data.roomId;
        socket.to(data.roomId).emit("user-joined", {
            username:data.username
        });
    });
    socket.on("chat-message", (message)=>{
        const data={
            username: socket.data.username,
            message
        };
        io.to(socket.data.roomId).emit("chat-message", data);
    });
})
const PORT = 3000;
server.listen(PORT, ()=> {console.log(`Server running on port ${PORT}`);});
