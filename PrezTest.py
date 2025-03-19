import asyncio
import time
import sys
import math
import socketio
from bleak import BleakClient
from pycycling.cycling_power_service import CyclingPowerService

SENSOR_ADDRESS = "B39283B0-F675-456D-E265-9EE860DE185F"
sio = socketio.Client()
# Remplace par ton URL, ex. "http://localhost:5001" si tu testes en local,
# ou "https://michelin-bike.azurewebsites.net" comme dans ton code
sio.connect("https://michelin-bike.azurewebsites.net")

BASE_POWER = 150
GRADE_AMPLITUDE = 5
SIMULATION_PERIOD = 60
EFFICIENCY = 0.7

def clear_terminal():
    sys.stdout.write("\033[H\033[J")
    sys.stdout.flush()

async def connect_to_power_meter():
    time_start = time.time()
    try:
        print("Tentative de connexion au capteur BLE...")
        async with BleakClient(SENSOR_ADDRESS) as client:
            if client.is_connected:
                print("✅ Connecté au capteur BLE")
                power_service = CyclingPowerService(client)
                await power_service.enable_cycling_power_measurement_notifications()

                last_crank_revs = None
                last_crank_time = None
                total_distance = 0
                wheel_circumference = 622 * 3.1416 / 1000

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

                    elapsed_time = time.time() - time_start
                    grade = GRADE_AMPLITUDE * math.sin(2 * math.pi * elapsed_time / SIMULATION_PERIOD)
                    if grade >= 0:
                        target_power = BASE_POWER
                        power_recharge = 0
                    else:
                        target_power = BASE_POWER + abs(grade * 10)
                        power_recharge = EFFICIENCY * (BASE_POWER - target_power)

                    metrics = {
                        "power": puissance,
                        "cadence": round(cadence_rpm, 1),
                        "distance": round(total_distance, 2),
                        "revolutions": cumulative_crank_revs,
                        "grade": round(grade, 1),
                        "target_power": target_power,
                        "power_recharge": round(power_recharge, 2)
                    }

                    clear_terminal()
                    print(f"⚡ Puissance: {puissance} W | 🚴 Cadence: {cadence_rpm:.1f} RPM")
                    print(f"📏 Distance parcourue: {total_distance:.2f} m | 🔁 Révolutions: {cumulative_crank_revs}")
                    print(f"🟢 Pente: {grade:.1f}% | 🎯 Puissance cible: {target_power} W | 🔋 Recharge: {power_recharge:.2f} W")

                    sio.emit("metrics_update", metrics)

                power_service.set_cycling_power_measurement_handler(power_callback)

                print("Simulation BLE : en écoute indéfiniment (Contrôle-C pour quitter).")
                while True:
                    await asyncio.sleep(1)

            else:
                raise Exception("Capteur non connecté")

    except Exception as e:
        print(f"Erreur de connexion au capteur BLE: {e}")
        print("Lancement du mode simulation de données illimité (mock).")

        last_crank_revs = 0
        total_distance = 0
        wheel_circumference = 622 * math.pi / 1000
        simulated_cumulative_revs = 0

        print("Simulation de données illimitée (Contrôle-C pour quitter).")
        while True:
            await asyncio.sleep(1)
            current_time = time.time()
            elapsed_time = current_time - time_start
            delta_revs = 3 + int((math.sin(current_time) + 1) * 1)
            simulated_cumulative_revs += delta_revs
            cadence_rpm = 60 + 10 * math.sin(current_time / 5)
            total_distance += delta_revs * wheel_circumference
            puissance = BASE_POWER + 20 * math.sin(current_time / 3)
            grade = GRADE_AMPLITUDE * math.sin(2 * math.pi * elapsed_time / SIMULATION_PERIOD)

            if grade >= 0:
                target_power = BASE_POWER
                power_recharge = 0
            else:
                target_power = BASE_POWER + abs(grade * 10)
                power_recharge = EFFICIENCY * (BASE_POWER - target_power)

            metrics = {
                "power": round(puissance, 1),
                "cadence": round(cadence_rpm, 1),
                "distance": round(total_distance, 2),
                "revolutions": simulated_cumulative_revs,
                "grade": round(grade, 1),
                "target_power": target_power,
                "power_recharge": round(power_recharge, 2)
            }

            clear_terminal()
            print(f"⚡ Puissance: {metrics['power']} W | 🚴 Cadence: {metrics['cadence']} RPM")
            print(f"📏 Distance parcourue: {metrics['distance']} m | 🔁 Révolutions: {metrics['revolutions']}")
            print(f"🟢 Pente: {metrics['grade']}% | 🎯 Puissance cible: {metrics['target_power']} W | 🔋 Recharge: {metrics['power_recharge']} W")

            sio.emit("metrics_update", metrics)

asyncio.run(connect_to_power_meter())









"""import asyncio
import time
import json
import sys
import math
import socketio
from bleak import BleakClient
from pycycling.cycling_power_service import CyclingPowerService

# Adresse du capteur BLE
SENSOR_ADDRESS = "B39283B0-F675-456D-E265-9EE860DE185F"

# Connexion au serveur Flask-SocketIO
sio = socketio.Client()
sio.connect("http://0.0.0.0:5001")

# Paramètres de simulation
BASE_POWER = 150  # Puissance de base (W)
GRADE_AMPLITUDE = 5  # Variation de pente en pourcentage (%)
SIMULATION_PERIOD = 60  # Période d'oscillation de la pente (s)
EFFICIENCY = 0.7  # Rendement de la recharge de la batterie

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
        time_start = time.time()

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

            elapsed_time = time.time() - time_start
            grade = GRADE_AMPLITUDE * math.sin(2 * math.pi * elapsed_time / SIMULATION_PERIOD)

            if grade >= 0:
                target_power = BASE_POWER
                power_recharge = 0  # Pas de recharge en montée
            else:
                target_power = BASE_POWER + abs(grade * 10)  # Simulation du frein moteur
                power_recharge = EFFICIENCY * (BASE_POWER - target_power)  # Recharge

            metrics = {
                "power": puissance,
                "cadence": round(cadence_rpm, 1),
                "distance": round(total_distance, 2),
                "revolutions": cumulative_crank_revs,
                "grade": round(grade, 1),
                "target_power": target_power,
                "power_recharge": round(power_recharge, 2)
            }

            clear_terminal()
            print(f"⚡ Puissance: {puissance} W | 🚴 Cadence: {cadence_rpm:.1f} RPM")
            print(f"📏 Distance parcourue : {total_distance:.2f} m | 🔁 Révolutions : {cumulative_crank_revs}")
            print(f"🟢 Pente: {grade:.1f}% | 🎯 Puissance cible: {target_power} W | 🔋 Recharge: {power_recharge:.2f} W")

            sio.emit("metrics_update", metrics)

        power_service.set_cycling_power_measurement_handler(power_callback)

        while time.time() - time_start < 150:
            await asyncio.sleep(1)

        print("⏹️ Fin du parsing après 150 secondes")

asyncio.run(connect_to_power_meter())"""
