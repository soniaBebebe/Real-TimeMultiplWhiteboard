import {canvas,ctx} from "./canvas.js";
import socket from "./socket.js";

console.log("Realtime Whiteboard Started");

ctx.lineWidth=5;
ctx.lineCap="round";
ctx.strokeStyle="black";

const shapeTools=["rect", "line", "circle", "arrow"];

let isDrawing=false;

const colorPicker=document.getElementById("colorPicker");

const brushSize=document.getElementById("brushSize");

let currentColor="#000000";
let currentBrushSize=5;

const brushTool=document.getElementById("brushTool");
const eraserTool=document.getElementById("eraserTool");
const clearBoardButton=document.getElementById("clearBoard");
const undoBtn=document.getElementById("undoBtn");
const redoBtn=document.getElementById("redoBtn");
const rectTool=document.getElementById("rectTool");
const lineTool=document.getElementById("lineTool");
const circleTool=document.getElementById("circleTool");
const arrowTool=document.getElementById("arrowTool");

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

// let startX=0;
// let startY=0;

let boardHistory=[];

let usersList=document.getElementById("usersList");

let onlineUsers=[];

let redoHistory=[];

let currentStroke=null;
let shapeStart=null;

let currentTool="brush";
brushTool.classList.add("active");

socket.on("clear-board", ()=>{
    clearCanvas();
});

socket.on("sync-board", (newHistory)=>{
        boardHistory=newHistory;
        redoHistory=[];

        redrawBoard();
        // saveBoard();
    });

socket.on("stroke-add", (stroke)=>{
    boardHistory.push(stroke);
    redrawBoard();
});

socket.on("room-users", (users)=>{
    onlineUsers=users;
    renderUsers();
});

socket.on("shape-preview", (shape)=>{
    redrawBoard();
    drawShape(shape);
});

window.addEventListener("canvas-resized", redrawBoard);

brushTool.addEventListener("click", ()=>{
    currentTool="brush";
    brushTool.classList.add("active");
    eraserTool.classList.remove("active");
});

eraserTool.addEventListener("click", ()=>{
    currentTool="eraser";
    eraserTool.classList.add("active");
    brushTool.classList.remove("active");
});

function isShapeTool(){
    return shapeTools.includes(currentTool);
}

brushTool.addEventListener("click", ()=>setTool("brush"));
eraserTool.addEventListener("click", ()=>setTool("eraser"));
rectTool.addEventListener("click", ()=>setTool("rect"));
lineTool.addEventListener("click", ()=>setTool("line"));
circleTool.addEventListener("click", ()=>setTool("circle"));
arrowTool.addEventListener("click", ()=>setTool("arrow"));

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

undoBtn.addEventListener("click", ()=>{
    undo();
});

redoBtn.addEventListener("click",()=>{
    redo();
});

function draw(event){
    if (!isDrawing) return;

    const x=event.clientX;
    const y=event.clientY;

    if(isShapeTool()){
        const shape={
            type:currentTool,
            color:currentColor,
            brushSize:currentBrushSize,
            start:shapeStart,
            end:{x,y}
        };
        redrawBoard();
        drawShape(shape);
        socket.emit("shape-preview", shape);
        return
    }

    const color=currentTool==="eraser"
        ?"white"
        :currentColor;
    
    ctx.strokeStyle=color;
    ctx.lineWidth=currentBrushSize;
    ctx.lineTo(x,y);
    ctx.stroke();
    currentStroke.points.push({x,y});


    socket.emit("draw",{
        x,
        y,
        color,
        brushSize:currentBrushSize
    });

    // boardHistory.push({
    //     x,
    //     y,
    //     color: currenTool==="eraser"?"white": currentColor,
    //     brushSize:currentBrushSize
    // });
    // saveBoard();

    // redoHistory=[];

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

function startDrawing(event){
    isDrawing=true;

    const x=event.clientX;
    const y=event.clientY;

    if(isShapeTool()){
        shapeStart={x,y};
        return;
    }
    //zakonchili zdes'

    const color=currentTool==="eraser"
        ?"white"
        : currentColor;
    currentStroke={
        type:"freehand",
        color: color,
        brushSize: currentBrushSize,
        points:[
            {x,y}
        ]
    };
    ctx.beginPath();
    ctx.moveTo(x,y);
    socket.emit("start-draw", {x,y,color, brushSize: currentBrushSize});
}

function stopDrawing(event){
    if (!isDrawing) return;
    isDrawing=false;

    if(isShapeTool()){
        if(shapeStart){
            const shape={
                type:currentTool,
                color:currentColor,
                brushSize:currentBrushSize,
                start:shapeStart,
                end:{x:event.clientX, y:event.clientY}
            };
            boardHistory.push(shape);
            redoHistory=[];
            redrawBoard();
            socket.emit("stroke-end", shape);
            shapeStart=null;
        }
        socket.emit("end-draw");
        return;
    }

    if(currentStroke){
        boardHistory.push(currentStroke);
        redoHistory=[];
        socket.emit("stroke-end", currentStroke);
        currentStroke=null;
    }

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
    // if(roomId){
    //     localStorage.removeItem(`whiteboard-${roomId}`);
    //     boardHistory=[];
    // }
    boardHistory=[];
    redoHistory=[];
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

    const isMine=data.username===username;

    messageElement.className=isMine
        ?"chat-message mine"
        :"chat-message";
    
    messageElement.innerHTML=`
        <div class="chat-author">
            ${data.username}
            <span class="chat-time">
                ${data.time}
            </span>
        </div>
        
        <div class="chat-bubble">
            ${data.message}
        </div>
    `;

    chatMessages.appendChild(messageElement);

    chatMessages.scrollTop=chatMessages.scrollHeight;
});

socket.on("user-joined", (data)=>{
    if(!onlineUsers.includes(data.username)){
        onlineUsers.push(data.username);
        renderUsers();
    }
    const msg=document.createElement("div");
    msg.className="system-message";
    msg.textContent=
        `${data.username} joined the room`
    chatMessages.appendChild(msg);
    chatMessages.scrollTop=chatMessages.scrollHeight;
});

socket.on("user-left-chat", (data)=>{
    onlineUsers=onlineUsers.filter(user=> user !==data.username);
    renderUsers();
    const msg = document.createElement("div");

    msg.className="system-message";
    msg.textContent=`${data.username} left the room`;

    chatMessages.appendChild(msg);
    chatMessages.scrollTop=chatMessages.scrollHeight;
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

function saveBoard(){
    if(!roomId) return;

    localStorage.setItem(
        `whiteboard-${roomId}`,
        JSON.stringify(boardHistory)
    );
}

function loadBoard(){
    const savedBoard=localStorage.getItem(`whiteboard-${roomId}`);

    if (!savedBoard) return;

    boardHistory=JSON.parse(savedBoard);
    // ctx.beginPath();

    // boardHistory.forEach(point=>{
    //     ctx.strokeStyle=point.color;
    //     ctx.lineWidth=point.brushSize;

    //     ctx.lineTo(point.x, point.y);
    //     ctx.stroke();

    //     ctx.beginPath();
    //     ctx.moveTo(point.x, point.y);
    // });
    redrawBoard();

}

function renderUsers(){
    usersList.innerHTML="";
    onlineUsers.forEach(user=>{
        const item=document.createElement("div");
        item.className="user-item";
        item.innerHTML=`
            <div class="user-dot"></div>
            <span>${user}</span>
            `;
            usersList.appendChild(item);
    })
}

function drawShape(shape){
    const{type,color,brushSize, start,end}=shape;
    ctx.beginPath();
    ctx.strokeStyle=color;
    ctx.fillStyle=color;
    ctx.lineWidth=brushSize;
    ctx.lineCap="round";
    ctx.lineJoin="round";

    if(type==="rect"){
        ctx.strokeRect(start.x, start.y, end.x-start.x, end.y-start.y);
        return;
    }
    if(type==="line"){
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        return;
    }
    if(type==="circle"){
        const radius=Math.hypot(end.x-start.x, end.y-start.y);
        ctx.arc(start.x, start.y, radius, 0, Math.PI*2);
        ctx.stroke();
        return;
    }
    if(type==="arrow"){
        drawArrow(start, end, color, brushSize);
        return;
    }
}

function drawArrow(start,end,color,brushSize){
    const headLength=Math.max(12, brushSize*3);
    const angle=Math.atan2(end.y-start.y, end.x-start.x);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x-headLength*Math.cos(angle-Math.PI/6), end.y-headLength*Math.sin(angle-Math.PI/6));
    ctx.lineTo(end.x-headLength*Math.cos(angle+Math.PI/6), end.y-headLength*Math.sin(angle+Math.PI/6));
    ctx.closePath();
    ctx.fillStyle=color;
    ctx.fill();
}

function redrawBoard(){
    clearOnlyCanvas();
    boardHistory.forEach(item=>{
        if(item.type && item.type!=="freehand"){
            drawShape(item);
            return;
        }

   
        if(!item.points || item.points.length<2) return;
         ctx.beginPath();
        ctx.strokeStyle=item.color;
        ctx.lineWidth=item.brushSize;
        ctx.lineCap="round";
        ctx.lineJoin="round";
        ctx.moveTo(item.points[0].x,item.points[0].y);

        for (let i=1; i<item.points.length; i++){
            ctx.lineTo(item.points[i].x, item.points[i].y);
        };
        ctx.stroke();
        ctx.beginPath();
    });
    
}

function clearOnlyCanvas(){
    ctx.clearRect(0,0, canvas.width, canvas.height);

    ctx.fillStyle="white";
    ctx.fillRect(0,0, canvas.width, canvas.height);
}

function undo(){
    if(boardHistory.length===0) return;

    const lastPoint=boardHistory.pop();

    redoHistory.push(lastPoint);

    redrawBoard();

    socket.emit("sync-board", boardHistory);
}

function redo(){
    if(redoHistory.length===0) return;
    const restoredPoint=redoHistory.pop();

    boardHistory.push(restoredPoint);

    redrawBoard();

    socket.emit("sync-board", boardHistory);
}
function setTool(tool){
    currentTool=tool;

    brushTool.classList.remove("active");
    eraserTool.classList.remove("active");
    rectTool.classList.remove("active");
    lineTool.classList.remove("active");
    circleTool.classList.remove("active");
    arrowTool.classList.remove("active");

    if (tool==="brush") brushTool.classList.add("active");
    if (tool==="eraser") eraserTool.classList.add("active");
    if (tool==="rect") rectTool.classList.add("active");
    if (tool==="line") lineTool.classList.add("active");
    if (tool==="circle") circleTool.classList.add("active");
    if (tool==="arrow") arrowTool.classList.add("active");
}
