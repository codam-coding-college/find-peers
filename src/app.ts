import path from 'path'
import express from 'express'
import fs from 'fs'
import { writeProjectsToJSON } from './db'
import { Project } from './types'


const projectIDs: { [key: string]: number }[] = JSON.parse(fs.readFileSync('./data/projectIDs.json').toString())
let projects: Project[] = JSON.parse(fs.readFileSync('./data/projectUsers.json').toString());

// (async () => {
// 	await writeProjectsToJSON('./data/projectUsers.json', projectIDs)

// })()


const app = express()
app.get('/', async (req, res) => {
	const projectsFiltered = projects.map(project => ({
		name: project.name,
		users: project.users.filter(user => !(user.status == 'finished')).sort((a, b) => (a.status < b.status) ? -1 : 1)
	}))
	res.render('index.ejs', { projects: projectsFiltered })
})
app.set("views", path.join(__dirname, "../views"))
app.set('viewengine', 'ejs')
app.use(express.static('public/'))

const port = parseInt(process.env['PORT'] || '8080')
app.listen(port, () => console.log('app ready on port', port))
