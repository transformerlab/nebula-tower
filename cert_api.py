from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
import yaml
from nebula_api import NebulaAPI

# Import the hosts router
from hosts import router as hosts_router



# Use FastAPI lifespan event for startup config
@asynccontextmanager
async def lifespan(app):
    config_init()
    yield

app = FastAPI(lifespan=lifespan)

# Include the hosts router
app.include_router(hosts_router)

# Allow CORS for all origins (for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

nebula = NebulaAPI()

CA_CERT_PATH = "ca.crt"  # Adjust as needed
CA_KEY_PATH = "ca.key"  # Adjust as needed
CERTS_DIR = "./data/certs"

# Compute cert_dir, cert_path, key_path once
cert_dir = CERTS_DIR
cert_path = os.path.join(cert_dir, CA_CERT_PATH)
key_path = os.path.join(cert_dir, CA_KEY_PATH)

class CreateCARequest(BaseModel):
    name: str

@app.get("/api/ca")
def get_ca_cert():
    # Use precomputed cert_dir, cert_path, key_path
    cert_exists = os.path.exists(cert_path)
    key_exists = os.path.exists(key_path)
    cert_content = None
    
    if cert_exists:
        with open(cert_path, "r") as f:
            cert_content = f.read()
    
    return {"exists": cert_exists, "cert": cert_content, "key_exists": key_exists}

@app.post("/api/ca")
def create_ca_cert(req: CreateCARequest):
    # Use precomputed cert_dir, cert_path, key_path
    if not os.path.exists(cert_dir):
        os.makedirs(cert_dir)
    
    if os.path.exists(cert_path):
        raise HTTPException(status_code=400, detail="CA certificate already exists.")
    
    # Run nebula-cert ca -name <name> -out-crt <cert_path> -out-key <key_path>
    result = nebula.cert_mode("ca", ["-name", req.name, "-out-crt", cert_path, "-out-key", key_path])
    
    if os.path.exists(cert_path):
        with open(cert_path, "r") as f:
            return {"created": True, "cert": f.read(), "output": result}
    
    raise HTTPException(status_code=500, detail="Failed to create CA certificate. Output: " + result)

@app.get("/api/ca/info")
def get_ca_cert_info():
    # Use precomputed cert_path
    if not os.path.exists(cert_path):
        raise HTTPException(status_code=404, detail="CA certificate not found.")
    
    info = nebula.cert_mode("print", ["-json", "-path", cert_path])
    return {"info": info}

@app.get("/api/config/lighthouse")
def get_lighthouse_config():
    path = "./data/lighthouse.yaml"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Lighthouse config not found.")
    return FileResponse(path, media_type="text/yaml")


def config_init():
    data_dir = './data'
    config_path = os.path.join(data_dir, 'lighthouse.yaml')
    example_path = './config.yml.example'
    if not os.path.exists(data_dir):
        print("Creating data directory")
        os.makedirs(data_dir)

    # check if LIGHTHOUSE_PUBLIC_IP is set and is a number:
    import ipaddress

    lighthouse_public_ip = os.getenv("LIGHTHOUSE_PUBLIC_IP")
    if lighthouse_public_ip is not None:
        try:
            ipaddress.ip_address(lighthouse_public_ip)
        except ValueError:
            print("Error: LIGHTHOUSE_PUBLIC_IP is not a valid IP address. Please set it in .env")
            exit(1)
    print("LIGHTHOUSE_PUBLIC_IP is valid:", lighthouse_public_ip)

    if not os.path.exists(config_path):
        shutil.copy(example_path, config_path)
    # Edit am_lighthouse to true and clear static_host_map hosts
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    # Defensive: handle both dict and possible nested structure
    # Ensure the lighthouse config has only one property: am_lighthouse: true
    config['lighthouse'] = {'am_lighthouse': True}
    # Remove all hosts under static_host_map
    if 'static_host_map' in config and isinstance(config['static_host_map'], dict):
        config['static_host_map'] = {}
    with open(config_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)