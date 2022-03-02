# Find peers --> [find-peers.joppekoers.nl](https://find-peers.joppekoers.nl)

This website and script is meant to help students to find peers that are working on the same project

> This project is still in Beta, it so it can happen that:
- The website is offline for several hours
- The domain changes

This readme will be kept up to date with progress on this project. Do not use the slack for speculation.\
If you have any suggestions please open a issue on GitHub

## Developing
## Setup & configuration
- Create a Oauth application on [intra](https://profile.intra.42.fr/oauth/applications)
- Copy the file `./env/tokens.example.json` to `./env/tokens.json` and fill out the secret data
- Change the callback url in `./src/env.ts`
- The projects shown on the front page are listed in `./env/projectIDs.json`. Should the curriculum change, you can edit that file. Remember to restart the server and wait for the server to pull all the data from the intra api. See the `Run as script` section below for more info

## Running
### Docker
2 dockerfiles are provided\
`Dockerfile` is for production, you can change the port (default 8080) in the environment variable\
`Dockerfile.dev` is is for development

### Locally
- Install Nodejs
- Install dependencies\
`npm install`
- Build\
`npm run build`
- Option 1: Start webserver\
`npm run start` or `node build/app.js`
- Option 2: Run as script\
`node build/app.js --help`
