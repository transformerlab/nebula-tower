# Server

## Build and run:
- Download the app using the zip file in github
- Download the nebula binaries and store them in /bin by running `install_nebula_binaries.sh`
- Unzip nebula-tower-main.zip
- `cd nebula-tower-main`
- `cd frontend`
- `npm install`
- edit .env and add your server's address e.g. http://162.243.38.134:8000 (make sure you are editing your frontend/.env as there is a different /.env in the root of the project)
- `npm run build`
- `cd ..`
- install uv (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- `cp .env.sample .env`
- edit .env and set the variables
- run `uv run create_admin.py` and follow the instructions to create your first admin user (make sure to enable the promote flag)
- `uv run main.py` (you will have to do sudo in front if on macOS)

## To run this in development:

* backend: `uv run main.py` (you should do this using sudo on a mac)
* frontend: `cd frontend; npm run dev` after doing an `npm install`

# Clients

## Tauri app

### Dev:

go to `cd client/nebula-tower-menubar-app`
`npm install`
`npx tauri dev`

### Build for production:

`npm tauri build`
The build goes in `src-tauri/src/target/release`

