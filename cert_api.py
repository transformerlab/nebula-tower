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
from vars import DATA_DIR, ORGS_DIR, ORGS_FILE, SAFE_STRING_RE, IPV6_PREFIX, LIGHTHOUSE_IP, EXTERNAL_IP


# Import the hosts router
from hosts import router as hosts_router



# Use FastAPI lifespan event for startup config
@asynccontextmanager
async def lifespan(app):
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

@app.get("/api/lighthouse/config")
def get_all_configs():
    lighthouse_path = "./data/lighthouse/config.yaml"
    ca_cert_path = "./data/lighthouse/ca.crt"
    host_cert_path = "./data/lighthouse/host.crt"
    host_key_path = "./data/lighthouse/host.key"

    configs = {}

    if os.path.exists(lighthouse_path):
        with open(lighthouse_path, "r") as f:
            configs["config"] = f.read()
    else:
        configs["config"] = None

    if os.path.exists(ca_cert_path):
        with open(ca_cert_path, "r") as f:
            configs["ca_cert"] = f.read()
    else:
        configs["ca_cert"] = None

    if os.path.exists(host_cert_path) and os.path.exists(host_key_path):
        with open(host_cert_path, "r") as cert_file, open(host_key_path, "r") as key_file:
            configs["host_cert"] = cert_file.read()
            key_content = key_file.read()
            configs["host_key"] = key_content[:48] + "..." + key_content[-5:]  # Hide most of the key
    else:
        configs["host_cert"] = None
        configs["host_key"] = None

    return configs

@app.post("/api/lighthouse/create_config")
def create_lighthouse_config():
    config_init_lighthouse()
    return {"status": "success"}

def config_init_lighthouse():
    data_dir = './data'
    lighthouse_dir = os.path.join(data_dir, "lighthouse")
    config_path = os.path.join(lighthouse_dir, "config.yaml")
    example_path = './config.yml.example'
    if not os.path.exists(data_dir):
        print("Creating data directory")
        os.makedirs(data_dir)
    if not os.path.exists(lighthouse_dir):
        print("Creating lighthouse directory")
        os.makedirs(lighthouse_dir)
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

    create_lighthouse_certs()


def create_lighthouse_certs():
    print("Creating certificates for lighthouse")
    
    # Check if data/lighthouse exists, if not create it:
    lighthouse_dir = "./data/lighthouse"
    os.makedirs(lighthouse_dir, exist_ok=True)
    print(f"Lighthouse directory created or exists: {lighthouse_dir}")

    out_crt = os.path.join(lighthouse_dir, "host.crt")
    out_key = os.path.join(lighthouse_dir, "host.key")
    print(f"Output certificate path: {out_crt}, Output key path: {out_key}")

    # Optionally, you can set ca_crt and ca_key to org-specific CA if needed
    ca_crt = os.path.join(os.path.dirname(__file__), "data", "certs", "ca.crt")
    ca_key = os.path.join(os.path.dirname(__file__), "data", "certs", "ca.key")
    print(f"CA certificate path: {ca_crt}, CA key path: {ca_key}")

    # Use the required format for networks: "<ip>/64"
    networks = f"{LIGHTHOUSE_IP}/64"

    nebula = NebulaAPI()
    print("Signing certificate with NebulaAPI...")
    result = nebula.sign_cert(
        name="lighthouse1",
        networks=networks,
        out_crt=out_crt,
        out_key=out_key,
        ca_crt=ca_crt,
        ca_key=ca_key,
    )

    # Also copy ca.crt to host directory:
    ca_crt_dest = os.path.join(lighthouse_dir, "ca.crt")
    if not os.path.exists(ca_crt_dest):
        shutil.copy(ca_crt, ca_crt_dest)