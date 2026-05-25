import {canvas,ctx} from "./canvas.js";
import socket from "./socket.js";

console.log("Realtime Whiteboard Started");

ctx.lineWidth=5;
ctx.lineCap="round";
ctx.strokeStyle="black";

let isDrawing=false;

const colorPicker=document.getElementById("colorPicker");

const brushSize=document.getElementById("brushSize");

let currentColor="#000000";
let currentBrushSize=5;

const brushTool=document.getElementById("brushTool");
const eraserTool=document.getElementById("eraserTool");
const clearBoardButton=document.getElementById("clearBoard");

let currenTool="brush";
brushTool.classList.add("active");

socket.on("clearBoard", ()=>{
    clearCanvas();
});

brushTool.addEventListener("click", ()=>{
    currenTool="brush";
    brushTool.classList.add("active");
    eraserTool.classList.remove("active");
});

eraserTool.addEventListener("click", ()=>{
    currenTool="eraser";
    eraserTool.classList.add("active");
    brushTool.classList.remove("active");
});

canvas.addEventListener("mousedown", startDrawing);

canvas.addEventListener("mouseup", stopDrawing);

canvas.addEventListener("mousemove", draw);

colorPicker.addEventListener("input", (event)=>{
    currentColor=event.target.value;
    ctx.strokeStyle=currentColor;
});

brushSize.addEventListener("input", (event)=>{
    currentBrushSize=event.target.value;
    ctx.lineWidth=currentBrushSize;
});

clearBoardButton.addEventListener("click",()=>{
    clearCanvas();
    socket.emit("clear-board");
});

function draw(event){
    if (!isDrawing) return;

    const x=event.clientX;
    const y=event.clientY;

    if(currenTool==="eraser"){
        ctx.strokeStyle="white";
    } else{
        ctx.strokeStyle=currentColor;
    }
    ctx.lineWidth=currentBrushSize;
    ctx.lineTo(x,y);
    ctx.stroke();

    socket.emit("draw",{
        x,
        y,
        color:currenTool==="eraser"
        ?"white"
        :currentColor,
        brushSize:currentBrushSize
    });

    ctx.beginPath();
    ctx.moveTo(x,y);
}

socket.on("start-draw", (data)=>{
    ctx.beginPath();
    ctx.moveTo(data.x, data.y);
});

socket.on("draw", (data)=>{
    ctx.strokeStyle=data.color;
    ctx.lineWidth=data.brushSize;
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

function clearCanvas(){
    ctx.clearRect(
        0,0,canvas.width, canvas.height
    );
    ctx.fillStyle="white";
    ctx.fillRect(
        0,0,canvas.width,canvas.height
    );
}
