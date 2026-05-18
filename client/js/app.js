import {canvas,ctx} from "./canvas.js";
import socket from "./socket.js";

console.log("Realtime Whiteboard Started");

ctx.lineWidth=5;
ctx.lineCap="round";

let isDrawing=false;

canvas.addEventListener("mousedown", ()=>{
    isDrawing=true;
});

canvas.addEventListener("mouseup", ()=>{
    isDrawing=false;
    ctx.beginPath();
});

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

socket.on("draw", (data)=>{
    drawRemote(data);
});

function drawRemote(data){
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
}