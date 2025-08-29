from fastapi import APIRouter
import os
import yaml
import shutil
from nebula_api import NebulaAPI
from vars import LIGHTHOUSE_IP

router = APIRouter()

@router.get("/api/lighthouse/config")
def get_all_configs():
    lighthouse_path = "data/lighthouse/config.yaml"
    ca_cert_path = "data/lighthouse/ca.crt"
    host_cert_path = "data/lighthouse/host.crt"
    host_key_path = "data/lighthouse/host.key"

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

@router.post("/api/lighthouse/create_config")
def create_lighthouse_config():
    config_init_lighthouse()
    create_lighthouse_certs()
    return {"status": "success"}

def config_init_lighthouse():
    data_dir = 'data'
    lighthouse_dir = os.path.join(data_dir, "lighthouse")
    config_path = os.path.join(lighthouse_dir, "config.yaml")
    example_path = 'config.yml.example'
    if not os.path.exists(data_dir):
        print("Creating data directory")
        os.makedirs(data_dir)
    if not os.path.exists(lighthouse_dir):
        print("Creating lighthouse directory")
        os.makedirs(lighthouse_dir)
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
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    config['lighthouse'] = {'am_lighthouse': True}
    config['static_host_map'] = {}
    config['firewall'] = {
        "conntrack": {
            "default_timeout": "10m",
            "tcp_timeout": "12m",
            "udp_timeout": "3m"
        },
        "inbound_action": "drop",
        "outbound": [
            {
                "host": "any",
                "port": "any",
                "proto": "any"
            }
        ],
        "outbound_action": "drop"
    }
    config['pki'] = {
        'ca': './data/lighthouse/ca.crt',
        'cert': './data/lighthouse/host.crt',
        'key': './data/lighthouse/host.key'
    }
    with open(config_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)

def create_lighthouse_certs():
    print("Creating certificates for lighthouse")
    lighthouse_dir = "data/lighthouse"
    os.makedirs(lighthouse_dir, exist_ok=True)
    print(f"Lighthouse directory created or exists: {lighthouse_dir}")
    out_crt = os.path.join(lighthouse_dir, "host.crt")
    out_key = os.path.join(lighthouse_dir, "host.key")
    print(f"Output certificate path: {out_crt}, Output key path: {out_key}")
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    ca_crt = os.path.join(project_root, "data", "certs", "ca.crt")
    ca_key = os.path.join(project_root, "data", "certs", "ca.key")
    print(f"CA certificate path: {ca_crt}, CA key path: {ca_key}")
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
    ca_crt_dest = os.path.join(lighthouse_dir, "ca.crt")
    if not os.path.exists(ca_crt_dest):
        shutil.copy(ca_crt, ca_crt_dest)
