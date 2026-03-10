let content_block = document.querySelector('#content_block');
function add_task() {
    let add_tasks = document.querySelector('#add_tasks');
    let over_load = document.querySelector('#over_load');
    add_tasks.classList.toggle('diplay_block_add_task');
    over_load.classList.toggle('diplay_block_add_task');
}