from slowapi import Limiter
from slowapi.util import get_remote_address

# Define the limiter here, so it can be imported by your main app and routers.
limiter = Limiter(key_func=get_remote_address)