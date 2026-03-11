let table_main = document.querySelector('#conten_table');
let nametoi = document.querySelector("#name");
let age = document.querySelector("#age");
let nam = document.querySelector("#nam");
let nu = document.querySelector("#nu");
let index_tt = -1;
let check_gioi_tinh;
let check_edit = false;
// localStorage.removeItem("data_users");
let data_user = localStorage.getItem("data_users") ? JSON.parse(localStorage.getItem("data_users")) : [];
function load_page()
{
    let block_data = 
    `
        <tr>
            <th>STT</th>
            <th>Ho va ten</th>
            <th>Tuoi</th>
            <th>Gioitinh</th>
            <th>Hành động</th>
        </tr>
    `;
    data_user.forEach((users, index) => {
        block_data += 
        `
        <tr>
            <td>${index + 1}</td>
            <td>${users.name}</td>
            <td>${users.age}</td>
            <td>${users.gioitinh}</td>
            <td><button onclick="delete_item(${index})">Xoá</button>
                <button onclick="edit_item(${index})">Sửa</button></td>
        </tr>
        `;
    });
    table_main.innerHTML = block_data;
}

load_page();

function add_data()
{
    if(nam.checked == true)
    {
        check_gioi_tinh = "Nam";
    }else
    {
        check_gioi_tinh = "Nữ";
    }
    console.log(index_tt);
    if(index_tt === -1)
    {
        data_user.push({
            index: index_tt,
            name: nametoi.value,
            age : age.value,
            gioitinh: check_gioi_tinh
        });
        localStorage.setItem("data_users", JSON.stringify(data_user));
        load_page();
    }else{
        data_user[index_tt].name = nametoi.value;
        data_user[index_tt].age = age.value;
        data_user[index_tt].gioitinh = check_gioi_tinh;
        localStorage.setItem("data_users", JSON.stringify(data_user));
        load_page();
    }

}
function delete_item(index)
{
    data_user.splice(index, 1);
    localStorage.setItem("data_users", JSON.stringify(data_user));
    load_page();
}
function edit_item(index)
{
    index_tt = index;
    check_edit = true;
    nametoi.value = data_user[index].name;
    age.value = data_user[index].age;
    if(data_user[index].gioitinh == "Nam")
    {
        nam.checked = true;
    }else{
        nu.checked = true;
    }
}