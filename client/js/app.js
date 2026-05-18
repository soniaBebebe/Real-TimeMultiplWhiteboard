import {canvas,ctx} from "./canvas.js";
import socket from "./socket.js";

console.log("Realtime Whiteboard Started");

ctx.lineWidth=5;
ctx.lineCap="round";
ctx.strokeStyle="black";

let isDrawing=false;

canvas.addEventListener("mousedown", startDrawing);

canvas.addEventListener("mouseup", stopDrawing);

canvas.addEventListener("mousemove", draw);

function draw(event){
    if (!isDrawing) return;

    const x=event.clientX;
    const y=event.clientY;

    ctx.lineTo(x,y);
    ctx.stroke();

    socket.emit("draw",{
        x,
        y
    });

    ctx.beginPath();
    ctx.moveTo(x,y);
}

socket.on("start-draw", (data)=>{
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
});

socket.on("draw", (data)=>{
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
});

socket.on("end-draw", ()=>{
    ctx.beginPath();
});

function drawRemote(data){
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
}

function startDrawing(event){
    isDrawing=true;

    const x=event.clientX;
    const y=event.clientY;
    ctx.beginPath();
    ctx.moveTo(x,y);
    socket.emit("start-draw", {x,y});
}

function stopDrawing(){
    isDrawing=false;
    ctx.beginPath();
    socket.emit("end-draw");
}