import asyncio
from bleak import BleakClient

ADDRESS = "B39283B0-F675-456D-E265-9EE860DE185F" 

async def connect_ble():
    async with BleakClient(ADDRESS) as client:
        print(f"✅ Connecté à {client.address}")
        services = await client.get_services()
        for service in services:
            print(f"🔹 Service: {service.uuid}")
            for char in service.characteristics:
                print(f"  📌 Caractéristique: {char.uuid} (Lecture: {char.properties})")

asyncio.run(connect_ble())
