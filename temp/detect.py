import asyncio
from bleak import BleakScanner

async def scan_ble():
    devices = await BleakScanner.discover()
    for device in devices:
        print(device)

asyncio.run(scan_ble())
