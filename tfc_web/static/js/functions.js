function searchFunction(search_box_id, list_id) {
    var input, filter, ul, li, a, i;
    input = document.getElementById(search_box_id);
    filter = input.value.toUpperCase();
    ul = document.getElementById(list_id);
    li = ul.getElementsByTagName('li');

    // Loop through all list items, and hide those who don't match the search query
    for (i = 0; i < li.length; i++) {
        a = li[i].getElementsByTagName("a")[0];
        if (a.innerHTML.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
}
