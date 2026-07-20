const canvas = document.getElementById("board");

const ctx=canvas.getContext("2d");

function resizeCanvas(){
    canvas.width=window.innerWidth;
    canvas.height=window.innerHeight;
    window.dispatchEvent(new Event("canvas-resized"));
}

window.addEventListener("resize", resizeCanvas);

resizeCanvas();

export{
    canvas,
    ctx
};