from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from nebula_api import NebulaAPI


# Import the hosts router
from routers.hosts_router import router as hosts_router
from routers.lighthouse_router import router as lighthouse_router
from routers.nebula_process_router import router as nebula_process_router


# Use FastAPI lifespan event for startup config
@asynccontextmanager
async def lifespan(app):
    yield

app = FastAPI(lifespan=lifespan)

# Include the hosts router
app.include_router(hosts_router)
app.include_router(lighthouse_router)
app.include_router(nebula_process_router)

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
        key_content = None

        if cert_exists:
            with open(cert_path, "r") as f:
                cert_content = f.read()
        
        if key_exists:
            with open(key_path, "r") as f:
                key_content = f.read()[:32]  # Only show the first 32 characters of the key
        
        return {"exists": cert_exists, "cert": cert_content, "key_exists": key_exists, "key": key_content}

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

