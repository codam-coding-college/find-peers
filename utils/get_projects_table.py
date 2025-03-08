"""
Run this script to update the project list from the 42 API
For it to work you need an .env file with a valid FOURTYTWO_API_UID and FOURTYTWO_API_SECRET
If you are a 42 student, you can create them by registering an application,
see: https://profile.intra.42.fr/oauth/applications
Note that the 42 API returns only 30 projects per page, therefore we request them in a loop
Currently, there are 57 pages, so this takes a few minutes.
"""


import json
import requests
from pathlib import Path


OUTFILE = 'allProjectIDs.json'


# read .env file
env = {}
for env_line in Path('.env').read_text().split('\n'):
    key, _, value = env_line.partition('=')
    env[key] = value


# get 42 token
url = "https://api.intra.42.fr/oauth/token"
payload = {
    'grant_type': 'client_credentials',
    'client_id': env['FOURTYTWO_API_UID'],
    'client_secret': env['FOURTYTWO_API_SECRET']
}
response = requests.post(url, params=payload)
access_token = response.json()['access_token']


# get 42 projects
page = 1
all_projects: list[dict] = []
headers = {"Authorization": f"Bearer {access_token}"}
while True:
    print(f"requesting page: {page}...")
    url = f"https://api.intra.42.fr/v2/projects?page={page}"
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"API response not OK; status code: {response.status_code}")
        break
    if len(response.json()) == 0:
        break
    all_projects += response.json()
    page+=1


# create json file with all projects
projects_id_slug_name = [
    {
        'id': project['id'],
        'slug': project['slug'],
        'name': project['name'],
    } for project in all_projects]
projects_id_slug_name.sort(key=lambda project: project['id'])
json_str = json.dumps(projects_id_slug_name, indent=4)
Path(OUTFILE).touch()
Path(OUTFILE).write_text(json_str)
