
let table = document.querySelector("#content-table");
function themba(){
let a = document.querySelector("#ten").value;
let b = document.querySelector("#tuoi").value;
let c = document.querySelector("#nam");
let d = document.querySelector("#nu");
console.log(a.value);
console.log(b.value);
console.log(c.checked);
console.log(d.checked);
let gioitinh;
if(c.checked == true)
{
        gioitinh = "nam";
}
if(d.checked == true){
        gioitinh = "nu";
}
table.innerHTML += 
`<tr>
    <td>${a.value}</td>
    <td>${b.value}</td>
    <td>${gioitinh}</td>
</tr>`
a.value = "";
b.value = "";
c.checked = false;
d.checked = false;
}