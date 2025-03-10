import asyncio
import time
import sys
from bleak import BleakClient
from pycycling.cycling_power_service import CyclingPowerService

def clear_terminal():
    sys.stdout.write("\033[H\033[J")
    sys.stdout.flush()

async def connect_to_power_meter(address):
    async with BleakClient(address) as client:
        print("✅ Connecté au capteur")
        services = await client.get_services()
        service_data = {}
        for service in services:
            for char in service.characteristics:
                if "read" in char.properties:
                    try:
                        value = await client.read_gatt_char(char.uuid)
                        service_data[service.uuid] = service_data.get(service.uuid, {})
                        service_data[service.uuid][char.uuid] = value
                    except Exception:
                        pass
        print("✅ Connecté au capteur de puissance")
        power_service = CyclingPowerService(client)
        await power_service.enable_cycling_power_measurement_notifications()
        last_crank_revs = None
        last_crank_time = None
        total_distance = 0
        wheel_circumference = 622 * 3.1416 / 1000  # en mètres
        def power_callback(data):
            nonlocal last_crank_revs, last_crank_time, total_distance
            puissance = getattr(data, 'instantaneous_power', 0)
            cumulative_crank_revs = getattr(data, 'cumulative_crank_revs', 0)
            last_crank_event_time = getattr(data, 'last_crank_event_time', 0)
            if last_crank_revs is not None and last_crank_time is not None:
                delta_revs = cumulative_crank_revs - last_crank_revs
                delta_time = (last_crank_event_time - last_crank_time) / 1024
                cadence_rpm = (delta_revs / delta_time) * 60 if delta_time > 0 else 0
                total_distance += delta_revs * wheel_circumference
            else:
                cadence_rpm = 0
            last_crank_revs = cumulative_crank_revs
            last_crank_time = last_crank_event_time
            clear_terminal()
            print("✅ Connecté au capteur de puissance")
            print(f"⚡ Puissance instantanée : {puissance} W")
            print(f"🚴 Révolutions totales du pédalier : {cumulative_crank_revs}")
            print(f"🔁 Dernier événement du pédalier : {last_crank_event_time}")
            print(f"⚡ Puissance: {puissance} W | 🚴 Cadence: {cadence_rpm:.1f} RPM")
            print(f"📏 Distance parcourue : {total_distance:.2f} m")
        power_service.set_cycling_power_measurement_handler(power_callback)
        start_time = time.time()
        while time.time() - start_time < 150:
            await asyncio.sleep(1)
        print("⏹️ Fin du parsing après 150 secondes")

asyncio.run(connect_to_power_meter("B39283B0-F675-456D-E265-9EE860DE185F"))
