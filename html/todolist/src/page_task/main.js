const works_text = document.title;
const display_text = document.querySelector("#text");
let index = 0;
setInterval(() => {
    if (index < works_text.length) {
        display_text.innerHTML += works_text[index];
        index++;
    }
}, 500);
