let menubar = document.querySelector("#slidemenu");
let overload = document.querySelector("#overload");
let hientheloai = document.querySelector("#slidemenu #theloai");
function clickmenu(){
    menubar.classList.toggle("hienthislide");
    overload.classList.toggle("hienthioverload");
    hientheloai.classList.remove("hientype");
}
function clicktheloai(){
    if(!hientheloai.classList.contains("hientype")){
        hientheloai.classList.add("hientype");
    }else{
        hientheloai.classList.remove("hientype");
    }
}