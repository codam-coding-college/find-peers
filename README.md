# Find peers --> [find-peers.codam.nl](https://find-peers.codam.nl)

This website is meant to help students to find peers that are working on the same project

## Developing
## Setup & configuration
- Create a Oauth application on [intra](https://profile.intra.42.fr/oauth/applications)
- Copy the file `./env/.env-example` to `./env/.env` and fill out the (secret) data

Also see `./src/env.ts` for more configuration

## Updating the secrets / API tokens
```shell
cd find-peers
vim env/.env
# make changes
docker compose down
docker compose up -d

# To get logs
docker logs --tail 10000 -f find-peers
```

## Configuration files
| File path                                    | Description                                                                           | Managed by server |
|----------------------------------------------|---------------------------------------------------------------------------------------|-------------------|
| `./env/.env-example`                         | Example file for api tokens, rename to `.env` to activate                             | no                |

## Running
The database of this project is in a folder called 'prisma' at the root of the project.

### Docker and Docker-compose
This is in production
```shell
git clone https://github.com/codam-coding-college/find-peers.git
cd find-peers
docker compose up -d

# To get logs
docker logs --tail 10000 -f find-peers
```

### Locally
- Install Nodejs >= 18.x
- Install dependencies\
`npm install`
- Generate the Prisma client\
`npx prisma generate`
- Run Prisma migration\
`npx prisma migrate dev`
- Start development server\
`npm run dev`
