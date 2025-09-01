from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from nebula_api import NebulaAPI


router = APIRouter()

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

@router.get("/api/ca")
def get_ca_cert():
    # Use precomputed cert_dir, cert_path, key_path
    cert_exists = os.path.exists(cert_path)
    key_exists = os.path.exists(key_path)
    cert_content = None
    key_content = None

    if cert_exists:
        try:
            with open(cert_path, "r") as f:
                cert_content = f.read()
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied when accessing the certificate file.")
    
    if key_exists:
        try:
            with open(key_path, "r") as f:
                key_content = f.read()[:32]  # Only show the first 32 characters of the key
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied when accessing the key file.")
    
    return {"exists": cert_exists, "cert": cert_content, "key_exists": key_exists, "key": key_content}

@router.post("/api/ca")
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

@router.get("/api/ca/info")
def get_ca_cert_info():
    # Use precomputed cert_path
    if not os.path.exists(cert_path):
        raise HTTPException(status_code=404, detail="CA certificate not found.")
    
    info = nebula.cert_mode("print", ["-json", "-path", cert_path])
    return {"info": info}

