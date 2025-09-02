# Build and run:
- Download the app using the zip file in github
- Download the nebula binaries and store them in /bin
- Unzip nebula-tower-main.zip
- `cd nebula-tower-main`
- `cd frontend`
- `npm install`
- edit .env and add your server's address e.g. http://162.243.38.134:8000 (make sure you are editing your frontend/.env as there is a different /.env in the root of the project)
- `npm run build`
- `cd ..`
- install uv
- `cp .env.sample .env`
- edit .env and set the variables
- `uv run main.py` (you will have to do sudo in front if on macOS)

# Development

## To run this in development:

* backend: `uv run main.py` (you should do this using sudo on a mac)
* frontend: `cd frontend; npm run dev` after doing an `npm install`

