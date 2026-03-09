let overload = document.querySelector("#overload");
let hientheloai = document.querySelector("#slidemenu #theloai");
let darkthanhmenu = document.querySelector("#menu");
let darkthanhslidemenu = document.querySelector("#slidemenu");
let darkthanhgioithieu = document.querySelector("#gioithieu");
let darkthanhtypephim = document.querySelector('#typephim');
let body = document.querySelector("body");
let nightModeIcon = document.querySelector("#nightmodeicon");
let lightModeIcon = document.querySelector("#lightmodeicon");
// const today = Temporal.Now.plainDateISO();
let today = new Date();
let year = today.getFullYear();
if(localStorage.getItem('themedualmode') == "") {
    localStorage.setItem('themedualmode', 'light');
}
function clickmenu() {
    if (darkthanhslidemenu) darkthanhslidemenu.classList.toggle("hienthislide");
    if (overload) 
    {
        overload.classList.toggle("hienthioverload");
    }
    if (hientheloai) hientheloai.classList.remove("hientype");
}
function clicktheloai() {
    if (hientheloai) {
        if (!hientheloai.classList.contains("hientype")) {
            hientheloai.classList.add("hientype");
        } else {
            hientheloai.classList.remove("hientype");
        }
    }
}
function clickdualmode() {

    if (!body.classList.contains("dark")) {
        if (nightModeIcon) nightModeIcon.classList.add("tatnightmode");
        if (lightModeIcon) lightModeIcon.classList.add("batlightmode");
        body.classList.add("dark", "dark3", "dark-contact");
        body.classList.remove("light3", "light-contact");

        if (darkthanhmenu) {
            darkthanhmenu.classList.add("dark2");
            darkthanhmenu.classList.remove("light2");
        }
        if (darkthanhslidemenu) {
            darkthanhslidemenu.classList.add("dark2");
            darkthanhslidemenu.classList.remove("light2");
        }
        if (darkthanhgioithieu) {
            darkthanhgioithieu.classList.add("dark1");
            darkthanhgioithieu.classList.remove("light1");
        }
        if (darkthanhtypephim) {
            darkthanhtypephim.classList.add("dark3");
            darkthanhtypephim.classList.remove("light3");
        }
        localStorage.setItem("themedualmode", "dark");
    } else {
        if (nightModeIcon) nightModeIcon.classList.remove("tatnightmode");
        if (lightModeIcon) lightModeIcon.classList.remove("batlightmode");
        body.classList.remove("dark", "dark3", "dark-contact");
        body.classList.add("light3", "light-contact");

        if (darkthanhmenu) {
            darkthanhmenu.classList.add("light2");
            darkthanhmenu.classList.remove("dark2");
        }
        if (darkthanhslidemenu) {
            darkthanhslidemenu.classList.add("light2");
            darkthanhslidemenu.classList.remove("dark2");
        }
        if (darkthanhgioithieu) {
            darkthanhgioithieu.classList.add("light1");
            darkthanhgioithieu.classList.remove("dark1");
        }
        if (darkthanhtypephim) {
            darkthanhtypephim.classList.add("light3");
            darkthanhtypephim.classList.remove("dark3");
        }
        localStorage.setItem("themedualmode", "light");
    }
}

function applyTheme() {
    let theme = localStorage.getItem('themedualmode');

    if (theme === 'dark') {
        if (nightModeIcon) nightModeIcon.classList.add("tatnightmode");
        if (lightModeIcon) lightModeIcon.classList.add("batlightmode");
        body.classList.add("dark", "dark3", "dark-contact");
        body.classList.remove("light3", "light-contact");

        if (darkthanhmenu) {
            darkthanhmenu.classList.add("dark2");
            darkthanhmenu.classList.remove("light2");
        }
        if (darkthanhslidemenu) {
            darkthanhslidemenu.classList.add("dark2");
            darkthanhslidemenu.classList.remove("light2");
        }
        if (darkthanhgioithieu) {
            darkthanhgioithieu.classList.add("dark1");
            darkthanhgioithieu.classList.remove("light1");
        }
        if (darkthanhtypephim) {
            darkthanhtypephim.classList.add("dark3");
            darkthanhtypephim.classList.remove("light3");
        }
    } else {
        if (nightModeIcon) nightModeIcon.classList.remove("tatnightmode");
        if (lightModeIcon) lightModeIcon.classList.remove("batlightmode");
        body.classList.remove("dark", "dark3", "dark-contact");
        body.classList.add("light3", "light-contact");

        if (darkthanhmenu) {
            darkthanhmenu.classList.add("light2");
            darkthanhmenu.classList.remove("dark2");
        }
        if (darkthanhslidemenu) {
            darkthanhslidemenu.classList.add("light2");
            darkthanhslidemenu.classList.remove("dark2");
        }
        if (darkthanhgioithieu) {
            darkthanhgioithieu.classList.add("light1");
            darkthanhgioithieu.classList.remove("dark1");
        }
        if (darkthanhtypephim) {
            darkthanhtypephim.classList.add("light3");
            darkthanhtypephim.classList.remove("dark3");
        }
    }
}

applyTheme();
//========================Contact===========================//
let hovaten = document.querySelector("#hovaten");
let outputhovaten = document.querySelector("#outputten");
let user = document.querySelector("#user");
let outputuser = document.querySelector("#outputuser");
let email = document.querySelector("#mail");
let outputemail = document.querySelector("#outputemail");
let telephone = document.querySelector("#phone");
let outputtel = document.querySelector("#outputtel");
let urlweb = document.querySelector("#web");
let outputweb = document.querySelector("#outputweb");
let search = document.querySelector("#input-search");
let outputsearch = document.querySelector("#outputsearch");
let numberage = document.querySelector("#age");
let outputage = document.querySelector("#outputage");
let numberof = document.querySelector("#num");
let outputnumberof = document.querySelector("#outputnumberof");
let date = document.querySelector("#date");
let outputtendate = document.querySelector("#outputtendate");
let file = document.querySelector("#file");
let outputfile = document.querySelector("#outputfile");
// =======
let alert_soverload = document.querySelector("#overload-alert");
let alertsuccess = document.querySelector("#alert-success");
let alertfail = document.querySelector("#alert-fail");
let checkage = false;
function check() {
    let info_contact = document.querySelector(".info-form-submit");
    info_contact.classList.add("hienthialert");
    if (hovaten) {
        if (outputhovaten.textContent !== "Họ và tên:") {
            outputhovaten.textContent = "Họ và tên:";
            outputhovaten.classList.add("missing-data");
        }
        if (hovaten.value === "") {
            outputhovaten.textContent += " (trống)";
        } else {
            outputhovaten.textContent += " " + hovaten.value;
            outputhovaten.classList.remove("missing-data");
        }
    }
    if (user) {
        if (outputuser.textContent !== "Tên đăng nhập:") {
            outputuser.textContent = "Tên đăng nhập:";
            outputuser.classList.add("missing-data");
        }
        if (user.value === "") {
            outputuser.textContent += " (trống)";
        } else {
            outputuser.textContent += " " + user.value;
            outputuser.classList.remove("missing-data");
        }
    }
    if (email) {
        if (outputemail.textContent !== "Email:") {
            outputemail.textContent = "Email:";
            outputemail.classList.add("missing-data");
        }
        if (email.value === "@gmail.com") {
            outputemail.textContent += " (trống)";
        } else {
            outputemail.textContent += " " + email.value;
            outputemail.classList.remove("missing-data");
        }
    }
    if (telephone) {
        if (outputtel.textContent !== "Số điện thoại:") {
            outputtel.textContent = "Số điện thoại:";
            outputtel.classList.add("missing-data");
        }
        if (telephone.value === "") {
            outputtel.textContent += " (trống)";
        } else {
            outputtel.textContent += " " + telephone.value;
            outputtel.classList.remove("missing-data");
        }
    }
    if (urlweb) {
        if (outputweb.textContent !== "Website:") {
            outputweb.textContent = "Website:";
            outputweb.classList.add("missing-data");
        }
        if (urlweb.value === "https://") {
            outputweb.textContent += " (trống)";
        } else {
            outputweb.textContent += " " + urlweb.value;
            outputweb.classList.remove("missing-data");
        }
    }
    if (search) {
        if (outputsearch.textContent !== "Tìm kiếm:") {
            outputsearch.textContent = "Tìm kiếm:";
        }
        if (search.value === "") {
            outputsearch.textContent += " (trống)";
        } else {
            outputsearch.textContent += " " + search.value;
            outputsearch.classList.remove("missing-data");
        }
    }
    if (numberage) {
        if (outputage.textContent !== "Tuổi:") {
            outputage.textContent = "Tuổi:";
            outputage.classList.add("missing-data");
        }
        if (numberage.value < 6 ) {
            outputage.textContent += " (trống)";
        } else {
            outputage.textContent += " " + numberage.value;
            outputage.classList.remove("missing-data");
        }
    }
    if (numberof) {
        let tuoi = numberof.value;
        if (outputnumberof.textContent !== "Số lượng:") {
            outputnumberof.textContent = "Số lượng:";
            outputnumberof.classList.add("missing-data");
        }
        if (numberof.value === "") {
            outputnumberof.textContent += " (trống)";
        } else {
            outputnumberof.textContent += " " + numberof.value;
            outputnumberof.classList.remove("missing-data");
        }
    }
    if (date) {
        let numberage = document.querySelector("#age");
        let arr = date.value.split("-");
        console.log(year - parseInt(arr[0]));
        if(year - parseInt(arr[0]) == numberage.value){
            checkage = true;
            console.log(checkage);
        }
        if (outputtendate.textContent !== "Ngày sinh:") {
            
            outputtendate.textContent = "Ngày sinh:";
            outputtendate.classList.add("missing-data");
        }
        if (date.value === "" || !checkage) {
            outputtendate.textContent += " (trống)";
        } else {
            outputtendate.textContent += " " + date.value;
            outputtendate.classList.remove("missing-data");
        }
    }
    if (file) {
        if (outputfile.textContent !== "Tài liệu đính kèm:") {
            outputfile.textContent = "Tài liệu đính kèm:";
            outputfile.classList.add("missing-data");
        }
        if (file.value === "") {
            outputfile.textContent += " (trống)";
        } else {
            outputfile.textContent += " " + file.value;
            outputfile.classList.remove("missing-data");
        }
    }
    let gioitinhnam = document.querySelector("#nam")
    let gioitinhnu = document.querySelector("#nu")
    if(hovaten.value === "" || user.value === "" || email.value === "@gmail.com" || telephone.value === "" || urlweb.value === "https://" || numberage.value < 6 || 
        numberof.value === "" || date.value === "" || file.value === "" || !checkage || (gioitinhnam.checked == false && gioitinhnu.checked == false))
     {
        alert_soverload.classList.add("hienthialert");
        alertfail.classList.add("hienthialert");
        localStorage.setItem("contactdata", "fail");
     }else
    {
        alert_soverload.classList.add("hienthialert");
        alertsuccess.classList.add("hienthialert");
        localStorage.setItem("contactdata", "success");
    }
}
function off_alert()
{
    if(alert_soverload)
    {
        alert_soverload.classList.remove("hienthialert");
        if(!alert_soverload.classList.contains("hienthialert"))
        {
            alertfail.classList.remove("hienthialert");   
            alertsuccess.classList.remove("hienthialert");
        }
    }
}
function refresh_data()
{
    let gioitinhnam = document.querySelector("#nam")
    let gioitinhnu = document.querySelector("#nu")
    let check_box_l = document.querySelectorAll("input[name=checkbox]");
    gioitinhnam.checked = false;
    gioitinhnu.checked = false;
    check_box_l.forEach(element => {
        element.checked = false;
    });
    if (hovaten) {
        hovaten.value = "";
    }
    if (user) {
        user.value = "";
    }
    if (email) {
        email.value = "@gmail.com";
    }
    if (telephone) {
        telephone.value = "";
    }
    if (urlweb) {
        urlweb.value = "https://";
    }
    if (search) {
        search.value = "";
    }
    if (numberage) {
        numberage.value = "";
    }
    if (numberof) {
        numberof.value = "";
    }
    if (date) {
        date.value = "";
    }
    if (file) {
        file.value = "";
    }
}
//========================Table-Contact===========================//
let index = 1;
function add_table() {
    content_table_info = document.querySelector(".content_table_info");
    if(localStorage.getItem("contactdata") === "success")
    {
        content_table_info.innerHTML += `
        <tr>
            <td>${index}</td>
            <td>${hovaten.value}</td>
            <td>${user.value}</td>
            <td>${email.value}</td>
            <td>${telephone.value}</td>
            <td>${urlweb.value}</td>
            <td>${search.value}</td>
            <td>${numberage.value}</td>
            <td>${numberof.value}</td>
            <td>${date.value}</td>
            <td>${file.value}</td>
        </tr>
        `;
        index++;
    }
}
function display_table()
{
    document.querySelector(".table_info").classList.toggle("display_table_info");
}
function refresh_table(){
    content_table_info = document.querySelector(".content_table_info");
    index = 1;
    content_table_info.innerHTML = `
    <tr>
        <th>STT</th>
        <th>Họ và tên</th>
        <th>Tên đăng nhập</th>
        <th>Email</th>
        <th>Số điện thoại</th>
        <th>Website</th>
        <th>Tìm kiếm</th>
        <th>Tuổi:</th>
        <th>Số lượng</th>
        <th>Ngày sinh</th>
        <th>Tài liệu đính kèm</th>
    </tr>
    `;
}