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
- The projects shown on the front page are listed in `./env/projectIDs.json`. Should the curriculum change, you can edit that file. Remember to restart the server and wait for the server to pull all the data from the intra api.

## Running
The 'database' of this project is a folder called 'database' at the root of the project.
### Docker
2 dockerfiles are provided\
`Dockerfile` is for production, you can change the port in the environment variable\
`Dockerfile.dev` is is for development
### Docker-compose
```yaml
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
- Option 3: Run as script\
`npm run build`\
`node build/app.js --help`
