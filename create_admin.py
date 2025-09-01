"""
Create the first admin (superuser) for Nebula Tower.

Usage:
  python create_admin.py --email you@example.com --password 'StrongPass123!'

If the user exists, you can promote it to superuser with:
  python create_admin.py --email you@example.com --promote
"""
import argparse
import asyncio
import os
from typing import Optional

from dotenv import load_dotenv

# Reuse app's DB and models
from api import (
    engine,
    Base,
    async_session_maker,
    User,
    UserManager,
)
from fastapi_users.db import SQLAlchemyUserDatabase


def load_env() -> None:
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)


def _sqlite_path_from_url(url: str) -> Optional[str]:
    if not url.startswith("sqlite+aiosqlite:"):
        return None
    # sqlite+aiosqlite:////absolute/path.db or sqlite+aiosqlite:///relative/path.db
    prefix = "sqlite+aiosqlite://"
    if not url.startswith(prefix):
        return None
    path_part = url[len(prefix):]
    # If path starts with one more '/', treat as absolute
    if path_part.startswith('/'):
        # leading '/' already represents absolute path (e.g., /Users/...)
        return path_part
    # Otherwise relative to current working directory
    return os.path.join(os.getcwd(), path_part)


def preflight_db_permissions() -> None:
    db_url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./nebula.db")
    db_path = _sqlite_path_from_url(db_url)
    if not db_path:
        return
    # Ensure directory exists
    dir_path = os.path.dirname(db_path)
    if dir_path and not os.path.exists(dir_path):
        os.makedirs(dir_path, exist_ok=True)
    # If file exists but not writable, raise a clear error
    if os.path.exists(db_path) and not os.access(db_path, os.W_OK):
        raise PermissionError(
            f"Database file is not writable: {db_path}. Fix by:\n"
            f"  - chown/chmod the file (e.g., chmod 664; chown $(whoami))\n"
            f"  - or remove it if disposable: rm '{db_path}'\n"
            f"  - or point DATABASE_URL to a writable location in .env"
        )


async def ensure_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def create_or_promote_admin(email: str, password: Optional[str], promote: bool) -> None:
    async with async_session_maker() as session:
        user_db = SQLAlchemyUserDatabase(session, User)
        manager = UserManager(user_db)

        # Check existing user by email
        existing = await user_db.get_by_email(email)
        if existing:
            if promote:
                update_dict = {
                    "is_superuser": True,
                    "is_active": True,
                    "is_verified": True,
                }
                await user_db.update(existing, update_dict)
                print(f"User {email} promoted to superuser.")
                return
            else:
                print(f"User {email} already exists. Use --promote to make superuser.")
                return

        if not password:
            raise ValueError("Password is required to create a new user. Provide --password.")

        # Create the user: hash password then create via user_db
        hashed_password = manager.password_helper.hash(password)
        await user_db.create(
            {
                "email": email,
                "hashed_password": hashed_password,
                "is_active": True,
                "is_superuser": True,
                "is_verified": True,
            }
        )
        print(f"Admin user created: {email}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Create the first admin (superuser) user")
    p.add_argument("--email", required=True, help="Email for the admin user")
    p.add_argument("--password", help="Password for the admin user (required unless --promote)")
    p.add_argument(
        "--promote",
        action="store_true",
        help="If the user exists, promote to superuser instead of creating",
    )
    return p.parse_args()


async def amain() -> None:
    load_env()
    preflight_db_permissions()
    args = parse_args()
    await ensure_tables()
    await create_or_promote_admin(args.email, args.password, args.promote)


if __name__ == "__main__":
    asyncio.run(amain())
