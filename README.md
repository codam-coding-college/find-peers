# Find peers --> [find-peers.joppekoers.nl](https://find-peers.joppekoers.nl)

This website is meant to help students to find peers that are working on the same project

## Developing
## Setup & configuration
- Create a Oauth application on [intra](https://profile.intra.42.fr/oauth/applications)
- Copy the file `./env/tokens.example.json` to `./env/tokens.json` and fill out the (secret) data

Also see `./src/env.ts` for more configuration

## Changing listed projects
- The projects shown on the front page are listed in `./env/projectIDs.json`. Should the curriculum change, you can edit that file. Remember to restart the server and wait for the server to pull all the data from the intra api.
- A list of all the projects and their corresponding ID in the 42 network (as of march 2022) can be found in `./env/allProjectIDs.json`

## Monitoring
At route `/status/pull` you can see a summary of the pull status of every campus

## Configuration files
| File path                                    | Description                                                                           | Managed by server |
|----------------------------------------------|---------------------------------------------------------------------------------------|-------------------|
| `./env/projectIDs.json`                      | List of all the projects and their corresponding ID to be displayed on the front page | no                |
| `./env/allProjectIDs.json`                   | List of all projects in the 42 network (as of march 2022)                             | no                |
| `./env/tokens.example.json`                  | Example file for api tokens, rename to `tokens.json` to activate                      | no                |
| `./env/campusIDs.json`                       | List of all campuses and their corresponding ID that are fetched from the 42 API      | no                |
| `./database/`                                | All database files, mount this when running in a docker container                     | yes               |
| `./database/sessions/`                       | All session files currently active                                                    | yes               |
| `./database/users.json`                      | Userdata associated with session                                                      | yes               |
| `./database/<campus_name>/lastpull.txt`      | Unix timestamp when the project users of that campus were last successfully updated   | yes               |
| `./database/<campus_name>/projectUsers.json` | Status of users for each project                                                      | yes               |

## Running
The 'database' of this project is a folder called 'database' at the root of the project.
### Docker
2 dockerfiles are provided\
`Dockerfile` is for production, you can change the port in the environment variable\
`Dockerfile.dev` is is for development
### Docker-compose
```yaml
version: "3"

services:
  find-peers:
    build: ./find-peers
    volumes:
       - ./local/database/path:/app/database
    environment:
       - PORT=8080
```

### Locally
- Install Nodejs >= 16.x
- Install dependencies\
`npm install`
- Build\
`npm run build`
- Option 1: Start development webserver\
`npm run dev`
- Option 2: Start production webserver\
`npm run build`\
`npm run start`
