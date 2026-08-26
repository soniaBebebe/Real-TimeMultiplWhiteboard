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
const liveStrokes={};
const livePreviews={};
let currentPreview=null;

let usersList=document.getElementById("usersList");

let onlineUsers=[];

let currentStroke=null;
let shapeStart=null;

let currentTool="brush";
brushTool.classList.add("active");

const historyCanvaas=document.createElement("canvas");
const historyCtx=historyCanvaas.getContext("2d");
let historyDirty=true;
let frameRequested=false;

function resizeHistoryCanvas(){
    historyCanvaas.width=canvas.width;
    historyCanvaas.height=canvas.height;
    historyDirty=true;
}

function invalidateHistory(){
    historyDirty=true;
    schelduleRender();
}

function schelduleRender(){
    if (frameRequested) return;
    frameRequested=true;
    requestAnimationFrame(()=>{
        frameRequested=false;
        renderUsers();
    });
}

function renderHistory(){
    historyCtx.clearRect(0,0,historyCanvaas.width, historyCanvaas.height);
    boardHistory.forEach((stroke)=>drawStroke(historyCtx,stroke));
    historyDirty=false;
}

function render(){
    if(historyDirty) renderHistory();

    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(historyCanvaas,0,0);
    Object.values(liveStrokes).forEach((stroke)=> drawStroke(ctx,stroke));
    Object.values(livePreviews).forEach((shape)=>drawStroke(ctx,shape));

    if(currentStroke) drawStroke(ctx,currentStroke);
    if(currentPreview) drawStroke(ctx,currentPreview);

    window.addEventListener("canvas-resized", ()=>{
        resizeHistoryCanvas();
        schelduleRender();
    })
}

resizeHistoryCanvas();
schelduleRender();

socket.on("clear-board", ()=>{
    boardHistory=[];
    Object.keys(liveStrokes).forEach((k)=> delete liveStrokes[k]);
    Object.keys(livePreviews).forEach((k)=>delete livePreviews[k]);
    currentStroke=null;
    currentPreview=null;
    shapeStart=null;
    invalidateHistory();
});

socket.on("stroke-remove", (id)=>{
    const next=boardHistory.filter((stroke)=>stroke.id !==id);
    if(next.length==boardHistory.length) return;
    boardHistory=next;
    invalidateHistory();
})

socket.on("sync-board", (history)=>{
        boardHistory= Array.isArray(history) ? history:[];
        invalidateHistory();
    });

socket.on("shape-preview", (data)=>{
    livePreviews[data.socketId]=data.shape;
    schelduleRender();
});

socket.on("stroke-add", (stroke)=>{
    if(!stroke || boardHistory.some((item)=> item.id === stroke.id)) return;
    boardHistory.push(stroke);
    invalidateHistory();
});

socket.on("room-users", (users)=>{
    onlineUsers=users;
    renderUsers();
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

    const {x,y}=pointerPosition(event);

    if(isShapeTool()){
        const currentPreview={
            type:currentTool,
            color:currentColor,
            brushSize:currentBrushSize,
            start:shapeStart,
            end:{x,y}
        };
        socket.emit("shape-preview", currentPreview);
        schelduleRender();
        return
    }

    if(!currentStroke) return;

    const last = currentStroke.points[currentStroke.points.length - 1];
    if(last && Math.hypot(x - last.x, y - last.y) <1) return;

    currentStroke.points.push({x,y});


    socket.emit("draw",{
        x,
        y,
    });

    schelduleRender();
}

socket.on("start-draw", (data)=>{
    liveStrokes[data.socketId]={
        type: "freehand",
        color: data.color,
        brushSize: data.brushSize,
        points: [{x: data.x, y:data.y}]
    };
    schelduleRender();
});

socket.on("draw", (data)=>{
    const stroke=liveStrokes[data.socketId];
    if(!stroke) return;
    stroke.points.push({x: data.x, y:data.y});
    schelduleRender();
});

socket.on("end-draw", (data)=>{
    const id=data && data.socketId;
    if (!id) return;
    delete liveStrokes[id];
    delete livePreviews[id];
    schelduleRender();
});

function startDrawing(event){
    isDrawing=true;

    const {x,y} = pointerPosition(event);

    if(isShapeTool()){
        shapeStart={x,y};
        currentPreview=null;
        return;
    }
    //zakonchili zdes'

    currentStroke={
        id: newId(),
        type:"freehand",
        color: currentColor,
        brushSize: currentBrushSize,
        points:[
            {x,y}
        ]
    };
    socket.emit("start-draw", {x,y,color: currentStroke.color, brushSize: currentBrushSize});

    schelduleRender();
}

function commitStroke(stroke){
    stroke.author = socket.id;
    boardHistory.push(stroke);
    socket.emit("stroke-end", stroke);
    invalidateHistory();
}

function strokeColor(){
    return currentTool==="eraser"?"white": currentColor;
}

function pointerPosition(event){
    const rect=canvas.getBoundingClientRect();
    return {x: event.clientX - rect.left, y: event.clientY - rect.top};
}

function newId(){
    return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function drawStroke(context, item){
    if (!item) return;
    if(item.type==="freehand" || item.type==="eraser"){
        drawFreehand(context, item);
        return;
    }
    drawShape(context, item);
}

function drawFreehand(context, stroke){
    const points=stroke.points;
    if (!points || points.length===0) return;
    context.save();
    if (stroke.type==="eraser"){
        context.globalCompositeOperation="destination-out";
        context.strokeStyle="rgba(0,0,0,1)";
        context.fillStyle="rgba(0,0,0,1)";
    } else {
        context.strokeStyle=stroke.color;
        context.fillStyle=stroke.color;
    }
    context.lineWidth = stroke.brushSize;
    context.lineCap="round";
    context.lineJoin="round";

    if(points.length===1){
        context.beginPath();
        context.arc(points[0].x, points[0].y, stroke.brushSize / 2, 0, Math.PI * 2);
        context.fill();
        context.restore();
        return;
    }
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i=1; i<points.length; i++){
        context.lineTo(points[i].x, points[i].y);
    }
    context.stroke();

    context.restore();
}

function stopDrawing(event){
    if (!isDrawing) return;
    isDrawing=false;

    if(isShapeTool()){
        if(shapeStart){
            const{x,y}=pointerPosition(event);
            commitStroke({
                id:newId(),
                type:currentTool,
                color:currentColor,
                brushSize:currentBrushSize,
                start:shapeStart,
                end:{x,y}
            });
            shapeStart=null;
        }
        currentPreview=null;
        socket.emit("end-draw");
        schelduleRender();
        return;
    }

    if(currentStroke){
        if(currentStroke.points.length >=2){
            commitStroke(currentStroke);
        }
        currentStroke=null;
    }

    socket.emit("end-draw");
    schelduleRender();
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

function drawShape(context,shape){
    const{type,color,brushSize, start,end}=shape;
    context.beginPath();
    context.strokeStyle=color;
    context.fillStyle=color;
    context.lineWidth=brushSize;
    context.lineCap="round";
    context.lineJoin="round";

    if(type==="rect"){
        context.strokeRect(start.x, start.y, end.x-start.x, end.y-start.y);
        return;
    }
    if(type==="line"){
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
        return;
    }
    if(type==="circle"){
        const radius=Math.hypot(end.x-start.x, end.y-start.y);
        context.arc(start.x, start.y, radius, 0, Math.PI*2);
        context.stroke();
        return;
    }
    if(type==="arrow"){
        drawArrow(start, end, color, brushSize);
        return;
    }
}

function drawArrow(context,start,end,color,brushSize){
    const headLength=Math.max(12, brushSize*3);
    const angle=Math.atan2(end.y-start.y, end.x-start.x);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    context.beginPath();
    context.moveTo(end.x, end.y);
    context.lineTo(end.x-headLength*Math.cos(angle-Math.PI/6), end.y-headLength*Math.sin(angle-Math.PI/6));
    context.lineTo(end.x-headLength*Math.cos(angle+Math.PI/6), end.y-headLength*Math.sin(angle+Math.PI/6));
    context.closePath();
    context.fillStyle=color;
    context.fill();
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
