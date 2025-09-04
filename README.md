# Server

## Build and run:

(currently works on MacOS and Linux)

- First make sure you have - <a href="https://docs.astral.sh/uv/">uv</a>

```
curl -LsSf https://astral.sh/uv/install.sh | sh
```

- <a href="https://github.com/transformerlab/nebula-tower/archive/refs/heads/main.zip">Download</a> and unzip or clone this Repo

```bash
./install_nebula_binaries.sh` # downloads nebula nightly
cd frontend
npm install # build th react app
```
- edit `frontend/.env` and set `VITE_API_BASE_URL` to your server's address e.g. http://162.243.38.134:8000 (make sure you are editing your `frontend/.env` as there is a different .env in the root of the project)

```
npm run build
cd ..
cp .env.sample .env
```

* edit .env and set the variables

- Run `uv run create_admin.py` and follow the instructions to create your first admin user (make sure to enable the promote flag)
- Now run `uv run main.py` (you will have to do sudo in front if on macOS)

## To run this in development:

Do the above but then run the frontend separately
`cd frontend; npm run dev`

# Client

## Tauri app

### Dev:

go to `cd client/nebula-tower-menubar-app`
`npm install`
`npx tauri dev`

### Build for production:

`npx tauri build`
The build goes in `src-tauri/src/target/release`

