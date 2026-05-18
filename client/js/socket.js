const socket = io("http://localhost:3000");

socket.on("connect", ()=>{
    console.log("Connected to server");
    console.log("Socket ID:", socket.id);
});

export default socket;