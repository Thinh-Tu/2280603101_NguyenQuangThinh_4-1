//HTTP request get,get/id,post,put/id, delete/id
async function LoadData() {
    try {
        let res = await fetch('http://localhost:3000/posts');
        let posts = await res.json()
        let body = document.getElementById("table-body");
        body.innerHTML = "";
        for (const post of posts) {
            body.innerHTML += `<tr>
                <td>${post.id}</td>
                <td>${post.title}</td>
                <td>${post.views}</td>
                <td><input type='submit' value='delete' onclick='Delete(${post.id})'/></td>
            </tr>`
        }
        return false;
    } catch (error) {
        console.log(error);
    }

}//
async function Save() {
    let id = document.getElementById("id_txt").value;
    let title = document.getElementById("title_txt").value;
    let views = document.getElementById("view_txt").value;
    let getItem = await fetch("http://localhost:3000/posts/" + id);
    if (getItem.ok) {
        //co item->put
        let res = await fetch('http://localhost:3000/posts/' + id,
            {
                method: 'PUT',
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(
                    {
                        title: title,
                        views: views
                    }
                )
            })
        if (res.ok) {
            console.log("edit du lieu thanh cong");
        }

    } else {
        let res = await fetch('http://localhost:3000/posts',
            {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(
                    {
                        id: id,
                        title: title,
                        views: views
                    }
                )
            })
    }
    if (res.ok) {
        console.log("them du lieu thanh cong");
    }
    LoadData();

}
async function Delete(id) {
    let res = await fetch('http://localhost:3000/posts/' + id, {
        method: 'Delete'
    });
    if (res.ok) {
        console.log("xoa thanh cong");
    }
    LoadData();
}
LoadData();
