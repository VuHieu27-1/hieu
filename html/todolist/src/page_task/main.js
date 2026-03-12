const works_text = document.title;
const display_text = document.querySelector("#text");
let index = 0;
setInterval(() => {
    if (index < works_text.length) {
        display_text.innerHTML += works_text[index];
        index++;
    }
}, 500);
//===============================ADD_ITEM_TASK=============================
const search_bar = document.querySelector("#search_bar")
const list_task_bar = document.querySelector(".list_task_bar")
let today = new Date()
let day = today.getDate();
let month = today.getMonth()+1; 
let year = today.getFullYear();
// localStorage.removeItem("data_item_work");
let data_text_item = localStorage.getItem("data_item_work") ? JSON.parse(localStorage.getItem("data_item_work")) : [];
function load_data()
{
    let block_text_item = ``;
    data_text_item.forEach(tasks=> {
        block_text_item += 
        `
        <div class="item_task_bar">
            <i class="material-icons" id="success_tasks">done_outline</i>
            <i class="material-icons">work</i>
            <div class="text_item_task_bar">
            <h3>${tasks.content}</h3>
            <p>${day}/${month}/${year}</p>
            </div>
            <div class="open_setting_item_bar">
            <i class="material-icons icon_setting_item" style="font-size: 30px;" onclick="open_setting(this)">more_horiz</i>
            <div class="icon_edit_item">
                <button>Edit</button>
                <button>Delete</button>
            </div>
            </div>
        </div> 
        `
    });
    list_task_bar.innerHTML = block_text_item;
} 
function add_item_task(){
    if(search_bar.value !== "")
    {
        data_text_item.push({
            content: search_bar.value
        })
        localStorage.setItem("data_item_work", JSON.stringify(data_text_item))
        load_data();
    }else
    {
        alert("Please enter the works information.")
    }
}
function open_setting(event){
    const icon_setting_item = event.parentElement.querySelector(".icon_edit_item");
    if(icon_setting_item)
    {
        icon_setting_item.classList.toggle("open_icon_edit_item");
    }
}
load_data();