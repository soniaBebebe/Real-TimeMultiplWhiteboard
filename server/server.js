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
        socket.broadcast.emit("start-draw", data);
    });

    socket.on("draw", (data)=>{
        socket.broadcast.emit("draw", data);
    });

    socket.on("end-draw", ()=>{
        socket.broadcast.emit("end-draw");
    });
})
const PORT = 3000;
server.listen(PORT, ()=> {console.log(`Server running on port ${PORT}`);});
