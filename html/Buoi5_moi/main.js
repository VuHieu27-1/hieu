let menubar = document.querySelector("#slidemenu");
let overload = document.querySelector("#overload");
let hientheloai = document.querySelector("#slidemenu #theloai");
let darkthanhmenu = document.querySelector("#menu");
let darkthanhslidemenu = document.querySelector("#slidemenu");
let darkthanhgioithieu = document.querySelector("#gioithieu");
let darkthanhtypephim = document.querySelector('#typephim');
if(localStorage.getItem('themedualmode') === 'light')
{
        document.querySelector("#nightmodeicon").classList.add("tatnightmode");
        document.querySelector("#lightmodeicon").classList.add("batlightmode");
        document.querySelector("body").classList.add("dark");
        document.querySelector("body").classList.add("dark3");
        document.querySelector("body").classList.remove("light3");
        darkthanhmenu.classList.add("dark2");
        darkthanhmenu.classList.remove("light2");
        darkthanhslidemenu.classList.add("dark2");
        darkthanhslidemenu.classList.remove("light2");
        darkthanhgioithieu.classList.add("dark1");
        darkthanhgioithieu.classList.remove("light1");
        darkthanhtypephim.classList.add("dark3");
        darkthanhtypephim.classList.remove("light3");
}else
{
        document.querySelector("#nightmodeicon").classList.remove("tatnightmode");
        document.querySelector("#lightmodeicon").classList.remove("batlightmode");
        document.querySelector("body").classList.remove("dark");
        document.querySelector("body").classList.add("light3");
        document.querySelector("body").classList.remove("dark3");
        darkthanhmenu.classList.add("light2");
        darkthanhmenu.classList.remove("dark2");
        darkthanhslidemenu.classList.add("light2");
        darkthanhslidemenu.classList.remove("dark2");
        darkthanhgioithieu.classList.add("light1");
        darkthanhgioithieu.classList.remove("dark1");
        darkthanhtypephim.classList.add("light3");
        darkthanhtypephim.classList.remove("dark3");
}
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
function clickdualmode()
{
    if(!document.querySelector("body").classList.contains("dark"))
    {
        document.querySelector("#nightmodeicon").classList.add("tatnightmode");
        document.querySelector("#lightmodeicon").classList.add("batlightmode");
        document.querySelector("body").classList.add("dark");
        document.querySelector("body").classList.add("dark3");
        document.querySelector("body").classList.remove("light3");
        darkthanhmenu.classList.add("dark2");
        darkthanhmenu.classList.remove("light2");
        darkthanhslidemenu.classList.add("dark2");
        darkthanhslidemenu.classList.remove("light2");
        darkthanhgioithieu.classList.add("dark1");
        darkthanhgioithieu.classList.remove("light1");
        darkthanhtypephim.classList.add("dark3");
        darkthanhtypephim.classList.remove("light3");
        localStorage.setItem("themedualmode", "light");

    }else{
        document.querySelector("#nightmodeicon").classList.remove("tatnightmode");
        document.querySelector("#lightmodeicon").classList.remove("batlightmode");
        document.querySelector("body").classList.remove("dark");
        document.querySelector("body").classList.add("light3");
        document.querySelector("body").classList.remove("dark3");
        darkthanhmenu.classList.add("light2");
        darkthanhmenu.classList.remove("dark2");
        darkthanhslidemenu.classList.add("light2");
        darkthanhslidemenu.classList.remove("dark2");
        darkthanhgioithieu.classList.add("light1");
        darkthanhgioithieu.classList.remove("dark1");
        darkthanhtypephim.classList.add("light3");
        darkthanhtypephim.classList.remove("dark3");
        localStorage.setItem("themedualmode", "dark");
    }
}