let menubar = document.querySelector("#slidemenu");
let overload = document.querySelector("#overload");
let hientheloai = document.querySelector("#slidemenu #theloai");
function clickmenu(){
    menubar.classList.toggle("hienthislide");
    overload.classList.toggle("hienthioverload");
}
function clicktheloai(){
    hientheloai.classList.toggle("hientype");
}