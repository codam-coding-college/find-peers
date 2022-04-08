const ProjectsContainer = document.querySelector("#projects");
const CampusSelector = document.querySelector("#campus-selector");
const ProjectSelector = document.querySelector("#project-selector");


function render_users(users) {
    if (users.length == 0)
        return "<p> <small> No users are subscribed to this project </small></p>";
    
    let rv = ""

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        rv += `
        <a class="user" href="https://profile.intra.42.fr/users/${user.login}" target="_blank">
            <img class="user-image" src="https://cdn.intra.42.fr/users/medium_${user.login}.jpg" loading="lazy"/>
            <div>
                ${user.login}
            </div>
            <div class="status">
                ${user.status}
            </div>
        </a>
        `
    }
    return rv;
}

async function get_projects() {
    const statuses = document.querySelectorAll("input[type=checkbox]:checked.search-checkbox");

    const statusSend = [];
    for (let i = 0; i < statuses.length; i++) {
        const e = statuses[i];
        statusSend.push(e.value);
    }

    fetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({
            campus: CampusSelector.value,
            projects: [document.querySelector("#project-selector").value],
            status: statusSend
        })
    }).then(res => res.json()).then(res => {

        let rv = "";
        console.log(res);
        for (let i = 0; i < res.length; i++) {
            const e = res[i];
            
            rv += `
                <div class="project">
                    <a id="${e.name}">
                    <div class="project-name">
                        <div>
                            ${e.name}
                        </div>
                        <div class="n-users">
                            ${e.users.length} users
                        </div>
                    </div>
                    </a>
                    <div class="users">
                        ${render_users(e.users)}
                    </div>
                </div>           
            
            `
        };
        ProjectsContainer.innerHTML = rv;


    });
}

function load_general(data) {
    for (let i = 0; i < data.campuses.length; i++) {
        const e = data.campuses[i];
        const option = document.createElement("option");

        option.value = e.name;
        option.innerHTML = e.name;

        CampusSelector.appendChild(option);
        if (e.name == data.userCampus)
            CampusSelector.selectedIndex = i;
    }
    for (let i = 0; i < data.projects.length; i++) {
        const e = data.projects[i];
        const option = document.createElement("option");

        option.value = e;
        option.innerHTML = e;

        ProjectSelector.appendChild(option);
    }

    document.querySelector("#update-time").innerHTML = data.updateEveryHours;
    document.querySelector("#last-update").innerHTML = data.lastUpdate;
    document.querySelector("#last-update-hours-ago").innerHTML = data.hoursAgo;


}

fetch("/api/general").then(res => res.json()).then((res) => {
    load_general(res)
    get_projects();
});

