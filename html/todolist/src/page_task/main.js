const works_text = document.title;
const display_text = document.querySelector("#text");
let sodem = 0;
let index_tt = -1;
setInterval(() => {
    if (sodem < works_text.length) {
        display_text.innerHTML += works_text[sodem];
        sodem++;
    }
}, 500);
//===============================ADD_ITEM_TASK=============================
const search_bar = document.querySelector("#search_bar")
const list_task_bar = document.querySelector(".list_task_bar")
let today = new Date()
let day = today.getDate();
let month = today.getMonth()+1; 
let year = today.getFullYear();
let color_edit = "white";
// localStorage.removeItem("data_item_work");
let data_text_item = localStorage.getItem("data_item_work") ? JSON.parse(localStorage.getItem("data_item_work")) : [];
function load_origin()
{
    index_tt = -1;
    search_bar.value = "";
    load_data();
} 
function load_data()
{
    let block_text_item = ``;
    data_text_item.forEach((tasks,index) => {
        let icon_success = tasks.checked_success ? "success_list_task" : "";
        let icon_work = tasks.checked_success ? "remove_works_tasks" : "";
        if(index_tt != index)
        {
            data_text_item[index].color = "white";
        }
        
        block_text_item += 
        `
        <div class="item_task_bar" id="id_item_task_bar" style="background: ${tasks.color}">
            <i class="material-icons ${icon_success}" id="success_tasks" onclick="click_refresh_task(${index})">done_outline</i>
            <i class="material-icons ${icon_work}" id="works_tasks" onclick="click_success_task(${index})">work</i>
            <div class="text_item_task_bar">
                <h3>${tasks.content}</h3>
                <p>${day}/${month}/${year}</p>
            </div>
            <input type="checkbox" name="success" id="tick_success_tasks">
            <div class="open_setting_item_bar">
            <i class="material-icons icon_setting_item" style="font-size: 30px;" onclick="open_setting(this)">more_horiz</i>
            <div class="icon_edit_item">
                <button onclick="edit_item_task(${index},this)">Edit</button>
                <button onclick="delete_item_task(${index})">Delete</button>
            </div>
            </div>
        </div> 
        `
    });
    list_task_bar.innerHTML = block_text_item;
} 
function add_item_task(){
    console.log()
    if(search_bar.value !== "" && index_tt == -1)
    {
        data_text_item.push({
            content: search_bar.value,
            color: color_edit,
            checked_success: false
        })
        localStorage.setItem("data_item_work", JSON.stringify(data_text_item));
        load_data();
        search_bar.value = "";
    }else if(index_tt != -1 && search_bar.value !== "")
    {
       data_text_item[index_tt].content = search_bar.value;
       data_text_item[index_tt].color = "white";
       index_tt = -1;
       localStorage.setItem("data_item_work", JSON.stringify(data_text_item));
       load_data();
       search_bar.value = "";
       action_edit = false;
    }else{
        alert("Please enter the works information.");
    }
}
search_bar.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        add_item_task();
    }
});
function open_setting(event){
    const icon_setting_item = event.parentElement.querySelector(".icon_edit_item");
    if(icon_setting_item)
    {
        icon_setting_item.classList.toggle("open_icon_edit_item");
    }
}
let action_delete = false;
let action_edit = false;
function delete_item_task(index)
{
    if(action_edit == false)
    {
        action_delete = true;
        data_text_item.splice(index,1);
        localStorage.setItem("data_item_work", JSON.stringify(data_text_item));
        load_data();
    }
    action_delete = false;
}
function edit_item_task(index)
{
    if(index_tt == -1 && action_delete == false)
    {
        action_edit = true;
        data_text_item[index].color = "linear-gradient(135deg, rgba(157, 245, 153, 0.7), rgba(193, 240, 175, 0.5))";
        index_tt = index;
        search_bar.value = data_text_item[index].content;
        localStorage.setItem("data_item_work", JSON.stringify(data_text_item));
        load_data();
    }
}
load_data();
//////////////////////////=========================SUCCESS_TASK===============================///////////////////////////////////////////////////
function click_success_task(index)
{
    data_text_item[index].checked_success = true;
    localStorage.setItem("data_item_work", JSON.stringify(data_text_item));
    load_data();
}
function click_refresh_task(index)
{
    data_text_item[index].checked_success = false;
    localStorage.setItem("data_item_work", JSON.stringify(data_text_item));
    load_data();
}
/////==================================================FILTER_Complete===============================//////////////////////////////////////////////////////
function filter_success()
{
    let block_text_item = ``;
    data_text_item.forEach((tasks,index) => {
    if(tasks.checked_success == true){

        let icon_success = "success_list_task";
        let icon_work =  "remove_works_tasks";
        if(index_tt != index)
            {
                data_text_item[index].color = "white";
            }
            
            block_text_item += 
            `
            <div class="item_task_bar" id="id_item_task_bar" style="background: ${tasks.color}">
            <i class="material-icons ${icon_success}" id="success_tasks" onclick="click_refresh_task(${index})">done_outline</i>
            <i class="material-icons ${icon_work}" id="works_tasks" onclick="click_success_task(${index})">work</i>
            <div class="text_item_task_bar">
            <h3>${tasks.content}</h3>
            <p>${day}/${month}/${year}</p>
            </div>
            <input type="checkbox" name="success" id="tick_success_tasks">
            <div class="open_setting_item_bar">
            <i class="material-icons icon_setting_item" style="font-size: 30px;" onclick="open_setting(this)">more_horiz</i>
            <div class="icon_edit_item">
            <button onclick="edit_item_task(${index},this)">Edit</button>
            <button onclick="delete_item_task(${index})">Delete</button>
            </div>
            </div>
            </div> 
            `
    }
});
list_task_bar.innerHTML = block_text_item;
}
/////==================================================FILTER_INCOMPLETE===============================//////////////////////////////////////////////////////
function filter_incomplete()
{
    let block_text_item = ``;
    data_text_item.forEach((tasks,index) => {
        console.log(tasks.content);
        console.log(tasks.checked_success);
    if(tasks.checked_success == false){
        let icon_success = "";
        let icon_work = "";
        if(index_tt != index)
            {
                data_text_item[index].color = "white";
            }
            
            block_text_item += 
            `
            <div class="item_task_bar" id="id_item_task_bar" style="background: ${tasks.color}">
            <i class="material-icons ${icon_success}" id="success_tasks" onclick="click_refresh_task(${index})">done_outline</i>
            <i class="material-icons ${icon_work}" id="works_tasks" onclick="click_success_task(${index})">work</i>
            <div class="text_item_task_bar">
            <h3>${tasks.content}</h3>
            <p>${day}/${month}/${year}</p>
            </div>
            <input type="checkbox" name="success" id="tick_success_tasks">
            <div class="open_setting_item_bar">
            <i class="material-icons icon_setting_item" style="font-size: 30px;" onclick="open_setting(this)">more_horiz</i>
            <div class="icon_edit_item">
            <button onclick="edit_item_task(${index},this)">Edit</button>
            <button onclick="delete_item_task(${index})">Delete</button>
            </div>
            </div>
            </div> 
            `
    }
});
list_task_bar.innerHTML = block_text_item;
}