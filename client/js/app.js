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

const joinScreen=document.getElementById("joinScreen");
const usernameInput=document.getElementById("usernameInput");
const roomInput=document.getElementById("roomInput");
const joinRoomBtn=document.getElementById("joinRoomBtn");
const chatForm=document.getElementById("chatForm");
const chatInput=document.getElementById("chatInput");
const chatMessages=document.getElementById("chatMessages");
const cursorsContainer=document.getElementById("cursorsContainer");
const removeCursors={};

let username="";
let roomId="";

let currenTool="brush";
brushTool.classList.add("active");

socket.on("clear-board", ()=>{
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

joinRoomBtn.addEventListener("click",(event)=>{
    event.preventDefault();
    username=usernameInput.value.trim();
    roomId=roomInput.value.trim();

    if(!username || !roomId) return;

    socket.emit("join-room", {
        username,
        roomId
    });
    joinScreen.style.display="none";
});

chatForm.addEventListener("submit", (event)=>{
    event.preventDefault();
    const message=chatInput.value.trim();
    
    if(!message) return;

    socket.emit("chat-message", message);

    chatInput.value="";
});

socket.on("chat-message", (data)=>{
    const messageElement=document.createElement("div");

    messageElement.innerHTML=`<b>${data.username}: </b>${data.message}`;
    chatMessages.appendChild(messageElement);

    chatMessages.scrollTop=chatMessages.scrollHeight;
});

socket.on("user-joined", (data)=>{
    const messageElement=document.createElement("div");
    messageElement.innerHTML=`<i>${data.username} joined the room</i>`;
    chatMessages.appendChild(messageElement);
});

window.addEventListener("mousemove", (event)=>{
    if (!roomId) return;
    socket.emit("cursor-move",{
        x:event.clientX,
        y:event.clientY
    });
});
socket.on("cursor-move", (data)=>{
    if(!removeCursors[data.socketId]){
        const cursor=document.createElement("div");
        cursor.className="cursor";

        cursor.innerHTML=`
            <div class="cursor-dot"></div>
            <div class="cursor-name">${data.username}</div>
        `;
        cursorsContainer.appendChild(cursor);
        removeCursors[data.socketId]=cursor;
    }
    const cursor=removeCursors[data.socketId];
    cursor.style.left=`${data.x}px`;
    cursor.style.top=`${data.y}px`;
})

socket.on("user-left", (socketId)=>{
    const cursor=removeCursors[socketId];
    if(!cursor) return;
    cursor.remove();
    delete removeCursors[socketId];
});