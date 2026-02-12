"""Standalone script to create the database table."""

import asyncio
from database import init_db, close_db


async def main():
    await init_db()
    print("Database table 'emotions' created successfully.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
