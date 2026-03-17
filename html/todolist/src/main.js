const content_block = document.querySelector('#content_block');
const content_block_all = document.querySelector('.content_all');
const block_end = document.querySelector('#block_fisrt');
const input_task_name = document.querySelector('#input_task_name');
const add_tasks = document.querySelector('#add_tasks');
// localStorage.removeItem("data_item_work");
var data = localStorage.getItem("info_content_block") ? JSON.parse(localStorage.getItem("info_content_block")) : [];
let color1 = "linear-gradient(135deg,  rgba(238, 251, 255, 0.8), rgba(99, 247, 239, 0.9) )";
let color2 = "linear-gradient(180deg,  rgba(157, 243, 186, 0.5), rgba(42, 168, 95, 0.6) )";
let color3 = "linear-gradient(155deg,  rgba(238, 181, 143, 0.5), rgba(233, 187, 37, 0.6) )";
let color4 = "linear-gradient(135deg,  rgba(255, 171, 171, 0.7), rgba(201, 26, 99, 0.8) )";
let color_choose = "white";
function add_task() {
    let add_tasks = document.querySelector('#add_tasks');
    let over_load = document.querySelector('#over_load');
    add_tasks.classList.toggle('diplay_block_add_task');
    over_load.classList.toggle('diplay_block_add_task');
}
///////////////////////////////XU-LY-JSON//////////////////////////////////////////////////////
function renderBlocks() {
    let blocksHtml = `
        <div class="block_content block_content_task content_all" id="block_fisrt">
            <i class="material-icons"  tabindex="1">apps</i>
            <p>All Tasks</p>
            <p class="number_of_task"><i class="material-icons size_point">none</i></p>
        </div>
    `;
    blocksHtml += `
        <div class="block_content block_content_task">
            <i class="material-icons" onclick="add_task()"  tabindex="2">add</i>
        </div>
    `;
    data.forEach((task, index) => {
        console.log(`${task.name}: ${task.status_success_tasks}`);
        blocksHtml += `
            <div class="block_content content_all" style="background:${task.color};">
                <a href="./page_task/index.html?id=${index}"><i class="material-icons" id="status_icon_work">assignment</i></a>
                <a href="./page_task/index.html?id=${index}"><i class="material-icons" id="status_icon_success">done_outline</i></a>
                <p>${task.name}</p>
                <i class="material-icons size_point" onclick="delete_block_task(${index})">delete</i>
            </div>
        `;
    });
    content_block.innerHTML = blocksHtml;
}
renderBlocks();
function select_color_1(){
    document.querySelector('.color_1').classList.toggle("effect_block");
    document.querySelector('.color_2').classList.remove("effect_block");
    document.querySelector('.color_3').classList.remove("effect_block");
    document.querySelector('.color_4').classList.remove("effect_block");
    color_choose = color1;
}
document.querySelector('.color_1').addEventListener("keydown", function(event)
{
    if(event.key == "Enter")
    {
        select_color_1();
    }
});
function select_color_2(){
    document.querySelector('.color_2').classList.toggle("effect_block");
    document.querySelector('.color_1').classList.remove("effect_block");
    document.querySelector('.color_3').classList.remove("effect_block");
    document.querySelector('.color_4').classList.remove("effect_block");
    color_choose = color2;
}
document.querySelector('.color_2').addEventListener("keydown", function(event)
{
    if(event.key == "Enter")
    {
        select_color_2();
    }
});
function select_color_3(){
    document.querySelector('.color_3').classList.toggle("effect_block");
    document.querySelector('.color_2').classList.remove("effect_block");
    document.querySelector('.color_1').classList.remove("effect_block");
    document.querySelector('.color_4').classList.remove("effect_block");
    color_choose = color3;
}
document.querySelector('.color_3').addEventListener("keydown", function(event)
{
    if(event.key == "Enter")
    {
        select_color_3();
    }
});
function select_color_4(){
    document.querySelector('.color_4').classList.toggle("effect_block");
    document.querySelector('.color_1').classList.remove("effect_block");
    document.querySelector('.color_2').classList.remove("effect_block");
    document.querySelector('.color_3').classList.remove("effect_block");
    color_choose = color4;
}
document.querySelector('.color_4').addEventListener("keydown", function(event)
{
    if(event.key == "Enter")
    {
        select_color_4();
    }
});
function add_block_tasks() {
    const taskName = input_task_name.value;
    let check_choose_color = false;
    if(document.querySelector('.color_1').classList.contains("effect_block") || document.querySelector('.color_2').classList.contains("effect_block") 
        || document.querySelector('.color_3').classList.contains("effect_block") || document.querySelector('.color_4').classList.contains("effect_block") )
    {
        check_choose_color = true; 
    }
    if (taskName !== "" && check_choose_color) {
        data.push({
            name: taskName,
            color: color_choose, 
            status_filter_success: false,
            status_filter_incomplete: false,
            status_success_tasks: false,
            subtask:[]
        });
        localStorage.setItem("info_content_block", JSON.stringify(data));
        renderBlocks();
        input_task_name.value = "";
        document.querySelector('.color_1').classList.remove("effect_block");
        document.querySelector('.color_2').classList.remove("effect_block");
        document.querySelector('.color_3').classList.remove("effect_block");
        document.querySelector('.color_4').classList.remove("effect_block");
        add_task();
    }else
    {
        alert("Task information is missing.");
    }
}
add_tasks.addEventListener("keydown", function(event)
{
    if(event.key == "Enter")
    {
        add_block_tasks();
    }
});
function delete_block_task(index) {
    data.splice(index, 1); 
    localStorage.setItem("info_content_block", JSON.stringify(data));
    renderBlocks();
}
//////////////////////////////////////ACTION_PAGE_TASK///////////////////////////////////////////////
setInterval(() => {
    change_status_tasks();
},300);
function change_status_tasks()
{
    let status_icon_work = document.querySelector('#status_icon_work');
    let status_icon_success = document.querySelector('#status_icon_success');
    data.forEach((task) => {
    console.log(`${task.name}: ${task.status_success_tasks}`);
    if(task.status_success_tasks == true)
    {
        status_icon_work.classList.add('add_status_icon_work');
        status_icon_success.classList.add('add_status_icon_success');
    }else
    {
        status_icon_work.classList.remove('add_status_icon_work');
        status_icon_success.classList.remove('add_status_icon_success');
    }
    });
}