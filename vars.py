import os
import re


ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT_DIR, 'data')
ORGS_DIR = os.path.join(DATA_DIR, 'orgs')
ORGS_FILE = os.path.join(ORGS_DIR, 'orgs.yaml')

SAFE_STRING_RE = re.compile(r'^[a-z0-9]+$')

IPV6_PREFIX = os.getenv("IPV6_PREFIX", "fdc8:d559:029d")
LIGHTHOUSE_IP = f"{IPV6_PREFIX}::1"
EXTERNAL_IP = os.getenv("LIGHTHOUSE_PUBLIC_IP")