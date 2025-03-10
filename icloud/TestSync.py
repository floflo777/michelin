import asyncio
import time
import json
import sys
import math
import socketio
from bleak import BleakClient
from pycycling.cycling_power_service import CyclingPowerService
from pycycling.fitness_machine_service import FitnessMachineService  # Ajout du service FTMS

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
        fitness_service = FitnessMachineService(client)  # Connexion au service FTMS
        
        await power_service.enable_cycling_power_measurement_notifications()

        last_crank_revs = None
        last_crank_time = None
        total_distance = 0
        total_energy_recharged = 0  # ⚡ Nouvelle variable pour stocker l'énergie totale
        last_time = time.time()  # ⏳ Stocke le temps de la dernière mise à jour

        wheel_circumference = 622 * 3.1416 / 1000  # en mètres
        time_start = time.time()

        async def update_slope_and_power():
            while True:
                elapsed_time = time.time() - time_start
                grade = GRADE_AMPLITUDE * math.sin(2 * math.pi * elapsed_time / SIMULATION_PERIOD)

                if grade >= 0:
                    target_power = BASE_POWER
                    power_recharge = 0  # Pas de recharge en montée
                else:
                    target_power = BASE_POWER + abs(grade * 10)  # Simulation du frein moteur
                    power_recharge = EFFICIENCY * abs(BASE_POWER - target_power)  # Recharge

                await fitness_service.set_simulation_parameters(0, int(grade * 100), 0, 0)
                await fitness_service.set_target_power(target_power)

                await asyncio.sleep(1)

        def power_callback(data):
            nonlocal last_crank_revs, last_crank_time, total_distance, total_energy_recharged, last_time

            puissance = getattr(data, 'instantaneous_power', 0)
            cumulative_crank_revs = getattr(data, 'cumulative_crank_revs', 0)
            last_crank_event_time = getattr(data, 'last_crank_event_time', 0)

            current_time = time.time()
            delta_time = current_time - last_time
            last_time = current_time  # Mise à jour du dernier temps

            if last_crank_revs is not None and last_crank_time is not None:
                delta_revs = cumulative_crank_revs - last_crank_revs
                delta_time_crank = (last_crank_event_time - last_crank_time) / 1024
                cadence_rpm = (delta_revs / delta_time_crank) * 60 if delta_time_crank > 0 else 0
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

            # ⚡ Calcul de l'énergie accumulée (Joules)
            total_energy_recharged += power_recharge * delta_time  # P(W) * t(s) = E(J)

            # ⚡ Conversion en Wh (1 Wh = 3600 J)
            total_energy_wh = total_energy_recharged / 3600

            metrics = {
                "power": puissance,
                "cadence": round(cadence_rpm, 1),
                "distance": round(total_distance, 2),
                "revolutions": cumulative_crank_revs,
                "grade": round(grade, 1),
                "target_power": target_power,
                "power_recharge": round(power_recharge, 2),
                "energy_recharged_j": round(total_energy_recharged, 2),
                "energy_recharged_wh": round(total_energy_wh, 4),
            }

            clear_terminal()
            print(f"⚡ Puissance: {puissance} W | 🚴 Cadence: {cadence_rpm:.1f} RPM")
            print(f"📏 Distance parcourue : {total_distance:.2f} m | 🔁 Révolutions : {cumulative_crank_revs}")
            print(f"🟢 Pente: {grade:.1f}% | 🎯 Puissance cible: {target_power} W | 🔋 Recharge: {power_recharge:.2f} W")
            print(f"⚡ Énergie stockée : {total_energy_recharged:.2f} J ({total_energy_wh:.4f} Wh)")

            sio.emit("metrics_update", metrics)

        power_service.set_cycling_power_measurement_handler(power_callback)

        asyncio.create_task(update_slope_and_power())

        while time.time() - time_start < 150:
            await asyncio.sleep(1)

        print("⏹️ Fin du parsing après 150 secondes")

asyncio.run(connect_to_power_meter())
