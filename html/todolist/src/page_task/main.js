// =============================SUB_TASK_ID==========================////////
let params = new URLSearchParams(window.location.search);
let sub_task = params.get("id");
// localStorage.removeItem("data_item_work");
var data = localStorage.getItem("info_content_block") ? JSON.parse(localStorage.getItem("info_content_block")) : [];
console.log(data[sub_task].status_filter_incomplete);
console.log(data[sub_task].status_filter_success);
//========================================================//////////////////
document.title = data[sub_task].name;
const works_text = data[sub_task].name;
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
// console.log(data[sub_task].subtask);
function load_origin()
{
    index_tt = -1;
    search_bar.value = "";
    load_data();
}
function check_status_success_task(){
    for(let element of data[sub_task].subtask)
    {
    console.log(element.checked_success);
    if(element.checked_success == false)
    {
        console.log(element.content);
        data[sub_task].status_success_tasks = false;
        localStorage.setItem("info_content_block", JSON.stringify(data));
        return;
    }else
    {
        console.log(element.content);
        data[sub_task].status_success_tasks = true;
    }
    }
    localStorage.setItem("info_content_block", JSON.stringify(data));
    console.log(data[sub_task].status_success_tasks);
} 

function load_data()
{
    data[sub_task].status_filter_incomplete = false;
    data[sub_task].status_filter_success = false;
    let block_text_item = ``;
    data[sub_task].subtask.forEach((tasks,index) => {
         
        let icon_success = tasks.checked_success ? "success_list_task" : "";
        let icon_work = tasks.checked_success ? "remove_works_tasks" : "";
        if(index_tt != index)
        {
            data[sub_task].subtask[index].color = "white";
        }
        if(tasks.content != undefined)
        {

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
    localStorage.setItem("info_content_block", JSON.stringify(data));
} 
// load_data();
if(data[sub_task].status_filter_incomplete == true && data[sub_task].status_filter_success ==false)
{
    filter_incomplete();
}else if(data[sub_task].status_filter_incomplete == false && data[sub_task].status_filter_success == true){
    filter_success();
}else{
    load_data();
}
function add_item_task(){
    console.log()
    if(search_bar.value !== "" && index_tt == -1)
    {
        data[sub_task].subtask.push({
            content: search_bar.value,
            color: color_edit,
            checked_success: false
        })
        localStorage.setItem("info_content_block", JSON.stringify(data));
        load_data();
        search_bar.value = "";
    }else if(index_tt != -1 && search_bar.value !== "")
    {
       data[sub_task].subtask[index_tt].content = search_bar.value;
       data[sub_task].subtask[index_tt].color = "white";
       index_tt = -1;
       localStorage.setItem("info_content_block", JSON.stringify(data));
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
let check_open_setting = false;
function open_setting(event){   
    console.log(`check_open_setting: ${check_open_setting}`);
    const icon_setting_item = event.parentElement.querySelector(".icon_edit_item");
    if(icon_setting_item)
    {
        icon_setting_item.classList.toggle("open_icon_edit_item");
        check_open_setting = true;
    }
}
// function off_open_setting(){
//     console.log(`check_open_setting: ${check_open_setting}`);
//     let icon_setting_item = document.querySelector(".icon_edit_item");
//     if(check_open_setting == false)
//     {
//         icon_setting_item.classList.remove("open_icon_edit_item");
//     }
//     check_open_setting = false;
// }
let action_delete = false;
let action_edit = false;
function delete_item_task(index)
{
    if(action_edit == false)
    {
        action_delete = true;
        data[sub_task].subtask.splice(index,1);
        localStorage.setItem("info_content_block", JSON.stringify(data));
        load_data();
    }else
    {
        alert("Please finish the current action before starting another.");
    }
    action_delete = false;
}
function edit_item_task(index)
{
    if(index_tt == -1 && action_delete == false)
    {
        action_edit = true;
        data[sub_task].subtask[index].color = "linear-gradient(135deg, rgba(157, 245, 153, 0.7), rgba(193, 240, 175, 0.5))";
        index_tt = index;
        search_bar.value = data[sub_task].subtask[index].content;
        localStorage.setItem("info_content_block", JSON.stringify(data));
        load_data();
    }else
    {
        alert("Please finish the current action before starting another.");
    }
}
//////////////////////////=========================SUCCESS_TASK===============================///////////////////////////////////////////////////
function click_success_task(index)
{
    data[sub_task].subtask[index].checked_success = true;
    localStorage.setItem("info_content_block", JSON.stringify(data));
    check_status_success_task();
    load_data();
}
function click_refresh_task(index)
{
    data[sub_task].subtask[index].checked_success = false;
    localStorage.setItem("info_content_block", JSON.stringify(data));
    check_status_success_task();
    load_data();
}
/////==================================================FILTER_Complete===============================//////////////////////////////////////////////////////
function filter_success()
{
    data[sub_task].status_filter_success = true;
    data[sub_task].status_filter_incomplete = false;
    let block_text_item = ``;
    data[sub_task].subtask.forEach((tasks,index) => {
    if(tasks.checked_success == true){

        let icon_success = "success_list_task";
        let icon_work =  "remove_works_tasks";
        if(index_tt != index)
            {
                data[sub_task].subtask[index].color = "white";
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
localStorage.setItem("info_content_block", JSON.stringify(data));
}
/////==================================================FILTER_INCOMPLETE===============================//////////////////////////////////////////////////////
function filter_incomplete()
{
    data[sub_task].status_filter_incomplete = true;
    data[sub_task].status_filter_success = false;
    let block_text_item = ``;
    data[sub_task].subtask.forEach((tasks,index) => {

    if(tasks.checked_success == false){
        let icon_success = "";
        let icon_work = "";
        if(index_tt != index)
            {
                data[sub_task].subtask[index].color = "white";
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
localStorage.setItem("info_content_block", JSON.stringify(data));
}