import os
from dotenv import load_dotenv
import uvicorn

env_path = os.path.join(os.path.dirname(__file__), ".env")
if not os.path.exists(env_path):
    print("Error: .env file not found at", env_path)
    exit(1)

# Load environment variables from .env file
load_dotenv(env_path)

if __name__ == "__main__":
    uvicorn.run("cert_api:app", host="0.0.0.0", port=8000, reload=True)
