# Nebula Tower

![Tray Icon](frontend/public/trayIcon.png)

# Concept

Nebula tower is a server and client app for the <a href="https://github.com/slackhq/nebula">Slack Nebula</a> mesh network. If you run this server on a server with a public IP address (such as a $6 / month Digital Ocean server) you can access it and in the UI:

- Create a CA Certificate
- Set up a Lighthouse server + config
- Create hosts and their respective certificates / config

Then clients (aka hosts) can download their config and connect to the Nebula mesh network using a script or a simple Tauri app.

Note that there are a couple things we do differently, to make things simple, than the recommended way to use Nebula. Mainly, we store the CA certs, the lighthouse certs and (for now) the host certs all on the tower. This makes the entire network less distributed in security.

Also note that we use the nightly version of nebula with v2 certs because we require IPv6 support in nebula in order to be able to create enough internal hosts while avoiding address conflicts. (more info here https://nebula.defined.net/docs/guides/upgrade-to-cert-v2-and-ipv6/)


# Run the Server

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

# Run the Client

## Tauri app

### Dev:

go to `cd client/nebula-tower-menubar-app`
`npm install`
`npx tauri dev`

### Build for production:

`npx tauri build`
The build goes in `src-tauri/src/target/release`

