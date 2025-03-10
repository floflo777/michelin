import asyncio
import time
import json
import sys
import socketio
from bleak import BleakClient
from pycycling.cycling_power_service import CyclingPowerService

# Adresse du capteur BLE (remplace par la bonne)
SENSOR_ADDRESS = "B39283B0-F675-456D-E265-9EE860DE185F"

# Connexion au serveur Flask-SocketIO
sio = socketio.Client()
sio.connect("http://0.0.0.0:5001")

def clear_terminal():
    sys.stdout.write("\033[H\033[J")
    sys.stdout.flush()

async def connect_to_power_meter():
    async with BleakClient(SENSOR_ADDRESS) as client:
        print("✅ Connecté au capteur BLE")
        
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

            metrics = {
                "power": puissance,
                "cadence": round(cadence_rpm, 1),
                "distance": round(total_distance, 2),
                "revolutions": cumulative_crank_revs
            }

            clear_terminal()
            print(f"⚡ Puissance: {puissance} W | 🚴 Cadence: {cadence_rpm:.1f} RPM")
            print(f"📏 Distance parcourue : {total_distance:.2f} m | 🔁 Révolutions : {cumulative_crank_revs}")

            # Envoi des données au serveur Flask-SocketIO
            sio.emit("metrics_update", metrics)

        power_service.set_cycling_power_measurement_handler(power_callback)

        start_time = time.time()
        while time.time() - start_time < 150:
            await asyncio.sleep(1)

        print("⏹️ Fin du parsing après 150 secondes")

asyncio.run(connect_to_power_meter())

