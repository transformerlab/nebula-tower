import os
import re


DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
ORGS_DIR = os.path.join(DATA_DIR, 'orgs')
ORGS_FILE = os.path.join(ORGS_DIR, 'orgs.yaml')

SAFE_STRING_RE = re.compile(r'^[a-z0-9]+$')

IPV6_PREFIX = "fdc8:d559:029d"
LIGHTHOUSE_IP = f"{IPV6_PREFIX}::1"
EXTERNAL_IP = os.getenv("LIGHTHOUSE_PUBLIC_IP")