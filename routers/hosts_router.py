import os
import yaml
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ipaddress import IPv6Network
from nebula_api import NebulaAPI
import shutil
from vars import DATA_DIR, ORGS_DIR, ORGS_FILE, ROOT_DIR, SAFE_STRING_RE, IPV6_PREFIX, LIGHTHOUSE_IP, EXTERNAL_IP
from fastapi.responses import FileResponse, StreamingResponse
import io
import zipfile
import secrets
import string
from datetime import datetime, timedelta
 
router = APIRouter()



def create_host_config(org, name):
    print(f"Creating host config for org: {org}, host: {name}")
    host_dir = os.path.join(ORGS_DIR, org, 'hosts', name)
    os.makedirs(host_dir, exist_ok=True)

    # Copy the config.yml.sample from the root dir to the hosts dir:
    sample_config_file = os.path.join(ROOT_DIR, 'config.yml.example')
    config_file = os.path.join(host_dir, 'config.yaml')
    shutil.copy(sample_config_file, config_file)

    # Now edit that file to set the following settings: 
    config = load_yaml(config_file, default={})

    # Set static_host_map
    config['static_host_map'] = {
        LIGHTHOUSE_IP: [f"{EXTERNAL_IP}:4242"]
    }

    # Set lighthouse
    config['lighthouse'] = {
        'am_lighthouse': False,
        'interval': 60,
        'hosts': [LIGHTHOUSE_IP]
    }

    # Set firewall section as specified
    config['firewall'] = {
        "conntrack": {
            "default_timeout": "10m",
            "tcp_timeout": "12m",
            "udp_timeout": "3m"
        },
        "inbound": [
            {
                "groups": ["org_" + org],
                "port": "any",
                "proto": "any"
            }
        ],
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

    # Tell the config that the keys and certs are in the same location
    config['pki'] = {
        "ca": "./ca.crt",
        "cert": "./host.crt",
        "key": "./host.key"
    }

    save_yaml(config_file, config)
    print(f"Host config saved to: {config_file}")

def create_certs(org, name):
    print(f"Creating certificates for org: {org}, host: {name}")
    
    # Create necessary directories and files for host certificates
    host_dir = os.path.join(ORGS_DIR, org, 'hosts', name)
    os.makedirs(host_dir, exist_ok=True)
    print(f"Host directory created or exists: {host_dir}")

    # Load host info to get tags and IP
    hosts_file = os.path.join(ORGS_DIR, org, 'hosts.yaml')
    print(f"Loading hosts file: {hosts_file}")
    hosts = load_yaml(hosts_file, default=[])
    host_entry = next((h for h in hosts if h['name'] == name), None)
    if not host_entry:
        raise Exception("Host entry not found for cert creation")
    print(f"Host entry found: {host_entry}")

    ip = host_entry['ip']
    # add a new group called "org_{org}" first
    groups = [f"org_{org}"]
    if host_entry.get('tags'):
        groups.extend(host_entry['tags'])
    groups = ",".join(groups)
    print(f"IP: {ip}, Groups: {groups}")

    out_crt = os.path.join(host_dir, "host.crt")
    out_key = os.path.join(host_dir, "host.key")
    print(f"Output certificate path: {out_crt}, Output key path: {out_key}")

    # Optionally, you can set ca_crt and ca_key to org-specific CA if needed
    ca_crt = os.path.join(DATA_DIR, "certs", "ca.crt")
    ca_key = os.path.join(DATA_DIR, "certs", "ca.key")
    print(f"CA certificate path: {ca_crt}, CA key path: {ca_key}")

    # Use the required format for networks: "<ip>/64"
    networks = f"{ip}/64"

    nebula = NebulaAPI()
    print("Signing certificate with NebulaAPI...")
    result = nebula.sign_cert(
        name=name,
        networks=networks,
        groups=groups,
        out_crt=out_crt,
        out_key=out_key,
        ca_crt=ca_crt,
        ca_key=ca_key,
    )

    # Also copy ca.crt to host directory:
    ca_crt_dest = os.path.join(host_dir, "ca.crt")
    if not os.path.exists(ca_crt_dest):
        shutil.copy(ca_crt, ca_crt_dest)

    create_host_config(org, name)

    print(f"Certificate signing result: {result}")
    # Optionally, you could log or handle 'result' if needed

# Helper to validate safe strings
def is_safe_string(s):
    return isinstance(s, str) and SAFE_STRING_RE.match(s)

def sanitize_string(s):
    if not isinstance(s, str):
        return ""
    sanitized = re.sub(r'[^a-zA-Z0-9]', '', s.lower())
    return sanitized

# Helper to load YAML
def load_yaml(path, default=None):
    if not os.path.exists(path):
        return default if default is not None else {}
    with open(path, 'r') as f:
        return yaml.safe_load(f) or (default if default is not None else {})

# Helper to save YAML
def save_yaml(path, data):
    with open(path, 'w') as f:
        yaml.safe_dump(data, f)

# Helper to load a file's content
def load_file(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, 'r') as f:
        return f.read()

# Helper to allocate a new IPv6 subnet (very simple, not production safe)
def allocate_subnet(orgs):
    """
    Allocate a new /64 subnet for an org using the ULA formula:
    IPV6_PREFIX (fdc8:d559:029d) + subnet_id (4 hex digits) + ::/64,
    formatted as fdc8:d559:029d:xxxx::/64

    Always assign the lowest available subnet_id, regardless of org name or order.
    Reserve 0000 for the router/lighthouse.
    """
    used_ids = set()
    # Extract used subnet_ids from existing subnets
    for subnet in orgs.values():
        try:
            parts = subnet.split(":")
            if len(parts) >= 4:
                used_ids.add(int(parts[3], 16))
        except Exception:
            continue
    # Always assign the lowest unused subnet_id, skipping 0x0000
    for subnet_id in sorted(set(range(1, 0x10000)) - used_ids):  # start from 1, not 0
        subnet_id_hex = f"{subnet_id:04x}"
        subnet = f"{IPV6_PREFIX}:{subnet_id_hex}::/64"
        return subnet
    raise Exception('No available subnets')

class HostRequest(BaseModel):
    name: str
    org: str
    tags: list[str]

@router.post('/api/hosts/new')
async def create_host(req: HostRequest):
    name = sanitize_string(req.name)
    org = sanitize_string(req.org)
    tags = [sanitize_string(t) for t in req.tags]

    # Validate input
    if not (is_safe_string(name) and is_safe_string(org)):
        raise HTTPException(status_code=400, detail='Invalid name or org')
    if not isinstance(tags, list) or not all(is_safe_string(t) for t in tags):
        raise HTTPException(status_code=400, detail='Invalid tags')
    if any(t.startswith("org") for t in tags):
        raise HTTPException(status_code=400, detail='Tags cannot start with "org"')

    # Ensure hosts dir exists
    os.makedirs(ORGS_DIR, exist_ok=True)

    # Load or create orgs.yaml
    orgs = load_yaml(ORGS_FILE, default={})
    if org not in orgs:
        subnet = allocate_subnet(orgs)
        orgs[org] = subnet
        save_yaml(ORGS_FILE, orgs)
    else:
        subnet = orgs[org]

    # Ensure org dir exists
    org_dir = os.path.join(ORGS_DIR, org)
    os.makedirs(org_dir, exist_ok=True)
    hosts_file = os.path.join(org_dir, 'hosts.yaml')

    hosts = load_yaml(hosts_file, default=[])
    if not isinstance(hosts, list):
        hosts = []

    # Ensure host name is unique within the org
    base_name = name
    suffix = 1
    existing_names = {h.get('name') for h in hosts}
    while name in existing_names:
        name = f"{base_name}{suffix}"
        suffix += 1

    # Assign next IP in subnet using ULA formula
    used_ips = {h['ip'] for h in hosts if 'ip' in h}
    net = IPv6Network(subnet)
    for host_id in range(1, 2**64):
        ip_int = int(net.network_address) + host_id
        ip_str = str(IPv6Network((ip_int, 128)).network_address)
        if ip_str not in used_ips and IPv6Network(ip_str + '/128').subnet_of(net):
            break
    else:
        raise HTTPException(status_code=500, detail='No available IPs in subnet')

    # Add host
    host_entry = {'name': name, 'ip': ip_str, 'tags': tags}
    hosts.append(host_entry)
    save_yaml(hosts_file, hosts)

    # Now create a unique directory just for this host:
    host_dir = os.path.join(org_dir, 'hosts', name)
    os.makedirs(host_dir, exist_ok=True)

    create_certs(org, name)

    return {"success": True, "host": host_entry, "org": org, "subnet": subnet, "name": name}

@router.get('/api/hosts')
async def list_hosts():
    if not os.path.exists(ORGS_DIR) or not os.path.isdir(ORGS_DIR):
        return {"hosts": []}
    
    hosts = []
    for org in os.listdir(ORGS_DIR):
        org_sanitized = sanitize_string(org)
        org_dir = os.path.join(ORGS_DIR, org)
        if not os.path.isdir(org_dir):
            continue
        hosts_file = os.path.join(org_dir, 'hosts.yaml')
        org_hosts = load_yaml(hosts_file, default=[])
        for host in org_hosts:
            hosts.append({**host, 'org': org_sanitized})
    return {"hosts": hosts}

class OrgRequest(BaseModel):
    name: str

@router.post("/api/orgs/new")
async def create_org(req: OrgRequest):
    name = sanitize_string(req.name)

    # Validate input
    if not is_safe_string(name):
        raise HTTPException(status_code=400, detail='Invalid org name')

    # Ensure org dir exists
    org_dir = os.path.join(ORGS_DIR, name)
    os.makedirs(org_dir, exist_ok=True)

    # Create initial hosts.yaml
    hosts_file = os.path.join(org_dir, 'hosts.yaml')
    save_yaml(hosts_file, [])

    return {"success": True, "org": name}

@router.get("/api/orgs")
async def list_orgs():
    if not os.path.exists(ORGS_DIR) or not os.path.isdir(ORGS_DIR):
        return {"orgs": []}

    orgs = []
    orgs_data = load_yaml(ORGS_FILE, default={})
    for org in os.listdir(ORGS_DIR):
        org_sanitized = sanitize_string(org)
        org_dir = os.path.join(ORGS_DIR, org)
        if not os.path.isdir(org_dir):
            continue
        orgs.append({"name": org_sanitized, "subnet": orgs_data.get(org_sanitized)})

    return {"orgs": orgs}

@router.get("/api/orgs/{org_name}/hosts")
async def list_org_hosts(org_name: str):
    org_name = sanitize_string(org_name)

    if not os.path.exists(ORGS_DIR) or not os.path.isdir(ORGS_DIR):
        return {"hosts": []}

    org_dir = os.path.join(ORGS_DIR, org_name)
    if not os.path.isdir(org_dir):
        return {"hosts": []}

    hosts_file = os.path.join(org_dir, 'hosts.yaml')
    org_hosts = load_yaml(hosts_file, default=[])
    return {"hosts": org_hosts}


@router.get("/api/orgs/{org_name}/hosts/{host_name}")
async def get_org_host(org_name: str, host_name: str):
    org_name = sanitize_string(org_name)
    host_name = sanitize_string(host_name)

    if not os.path.exists(ORGS_DIR) or not os.path.isdir(ORGS_DIR):
        return {"host": None}

    org_dir = os.path.join(ORGS_DIR, org_name)
    if not os.path.isdir(org_dir):
        return {"host": None}

    # now go to the directory in that host and look for a config.yaml, cert.key and cert.crt and return
    # the contents of all of these in json. The key should only return a part for security reasons
    host_dir = os.path.join(org_dir, 'hosts', host_name)
    if not os.path.isdir(host_dir):
        return {"host": None}

    config_file = os.path.join(host_dir, 'config.yaml')
    cert_key_file = os.path.join(host_dir, 'host.key')
    cert_crt_file = os.path.join(host_dir, 'host.crt')

    config = load_yaml(config_file, default={})
    cert_key = load_file(cert_key_file, default="")
    cert_crt = load_file(cert_crt_file, default="")

    # cert_details_json = ./nebula-cert print -path data/orgs/a/hosts/e/host.crt -json
    nebula = NebulaAPI()
    cert_details_json = nebula.print_cert(cert_crt_file)

    return {
        "host": {
            "name": host_name,
            "config": config,
            "cert_key": cert_key,
            "cert_crt": cert_crt,
            "cert_details": cert_details_json
        }
    }

@router.get("/api/orgs/{org_name}/hosts/{host_name}/download")
async def download_org_host_config(org_name: str, host_name: str):
    org_name = sanitize_string(org_name)
    host_name = sanitize_string(host_name)

    if not os.path.exists(ORGS_DIR) or not os.path.isdir(ORGS_DIR):
        raise HTTPException(status_code=404, detail="Org not found")

    org_dir = os.path.join(ORGS_DIR, org_name)
    if not os.path.isdir(org_dir):
        raise HTTPException(status_code=404, detail="Org not found")

    host_dir = os.path.join(org_dir, 'hosts', host_name)
    if not os.path.isdir(host_dir):
        raise HTTPException(status_code=404, detail="Host not found")

    mem_zip = io.BytesIO()
    with zipfile.ZipFile(mem_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for fname in ["config.yaml", "host.crt", "host.key", "ca.crt"]:
            fpath = os.path.join(host_dir, fname)
            if os.path.exists(fpath):
                arcname = f"{fname}"
                with open(fpath, "rb") as f:
                    zf.writestr(arcname, f.read())
    mem_zip.seek(0)
    return StreamingResponse(mem_zip, media_type="application/zip", headers={
        "Content-Disposition": f"attachment; filename={org_name}_{host_name}_config.zip"
    })

@router.get("/api/orgs/{org_name}/hosts/{host_name}/download_config")
async def download_org_host_config_plain(org_name: str, host_name: str):
    org_name = sanitize_string(org_name)
    host_name = sanitize_string(host_name)

    if not os.path.exists(ORGS_DIR) or not os.path.isdir(ORGS_DIR):
        raise HTTPException(status_code=404, detail="Org not found")

    org_dir = os.path.join(ORGS_DIR, org_name)
    if not os.path.isdir(org_dir):
        raise HTTPException(status_code=404, detail="Org not found")

    host_dir = os.path.join(org_dir, 'hosts', host_name)
    if not os.path.isdir(host_dir):
        raise HTTPException(status_code=404, detail="Host not found")

    config_file = os.path.join(host_dir, 'config.yaml')

    return FileResponse(config_file, media_type='application/x-yaml', filename=f"{org_name}_{host_name}_config.yaml")


# Generate Invite Code adds to a file called invites.yaml in the root of the DATA_DIR
# (it creates the file if missing). And in each invite, you have a randomized code
# with high entropy, an org, and a date when it expires
@router.post("/api/invites/generate")
async def generate_invite(org: str, days_valid: int = 7):
    org = sanitize_string(org)

    if not os.path.exists(ORGS_DIR):
        raise HTTPException(status_code=404, detail="Org directory does not exist")

    org_dir = os.path.join(ORGS_DIR, org)
    if not os.path.isdir(org_dir):
        raise HTTPException(status_code=404, detail=f"Org '{org}' not found")

    invite_code = generate_random_code()
    invite = {
        "code": invite_code,
        "org": org,
        "expires_at": datetime.utcnow() + timedelta(days=days_valid),
        "active": True  # Set active True by default
    }

    invites_file = os.path.join(DATA_DIR, "invites.yaml")
    save_invite(invites_file, invite)

    return {"invite": invite}

def generate_random_code(length=32):
    """
    Generate a high-entropy random invite code.
    """
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def save_invite(invites_file, invite):
    """
    Save an invite to the invites.yaml file. Appends to the list if file exists, otherwise creates a new list.
    """
    if os.path.exists(invites_file):
        with open(invites_file, "r") as f:
            invites = yaml.safe_load(f) or []
    else:
        invites = []
    invites.append(invite)
    with open(invites_file, "w") as f:
        yaml.safe_dump(invites, f)