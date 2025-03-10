import asyncio
import time
import math
from bleak import BleakClient
from pycycling.cycling_power_service import CyclingPowerService
from pycycling.fitness_machine_service import FitnessMachineService

# Configuration de la simulation
DEVICE_ADDRESS = "D9:45:C1:88:67:D5"
BASE_POWER = 200  # Puissance cible initiale en Watts
GRADE_AMPLITUDE = 10  # Amplitude de la pente en pourcentage (-10% à 10%)
WHEEL_CIRCUMFERENCE = 0.62  # Circonférence de la roue en mètres
SIMULATION_PERIOD = 30  # Période de la sinusoïde en secondes

time_start = time.time()
last_wheel_revs = None
distance_traveled = 0.0

async def connect_and_run(address):
    async with BleakClient(address) as client:
        print("✅ Connecté au capteur de puissance et de simulation")

        power_service = CyclingPowerService(client)
        fitness_service = FitnessMachineService(client)

        await power_service.enable_cycling_power_measurement_notifications()
        await fitness_service.enable_control_point_indicate()
        await fitness_service.request_control()
        await fitness_service.reset()

        def power_callback(data):
            global last_wheel_revs, distance_traveled

            instantaneous_power = data.instantaneous_power
            cumulative_wheel_revs = getattr(data, "cumulative_wheel_revs", None)
            wheel_event_time = getattr(data, "last_wheel_event_time", None)

            rpm = 0
            if last_wheel_revs is not None and cumulative_wheel_revs is not None:
                delta_revs = cumulative_wheel_revs - last_wheel_revs
                distance_traveled += delta_revs * WHEEL_CIRCUMFERENCE
                rpm = delta_revs * 60  # Estimation simplifiée

            last_wheel_revs = cumulative_wheel_revs

            print(f"⚡ Puissance: {instantaneous_power} W | 🚴 Cadence: {rpm:.1f} RPM | 📏 Distance: {distance_traveled:.2f} m")

        power_service.set_cycling_power_measurement_handler(power_callback)

        while True:
            elapsed_time = time.time() - time_start
            grade = GRADE_AMPLITUDE * math.sin(2 * math.pi * elapsed_time / SIMULATION_PERIOD)
            target_power = BASE_POWER if grade >= 0 else BASE_POWER + abs(grade * 10)  # Augmente la puissance en descente
            
            await fitness_service.set_simulation_parameters(0, int(grade * 100), 0, 0)
            await fitness_service.set_target_power(target_power)
            print(f"🟢 Pente: {grade:.1f}% | Puissance cible: {target_power} W")
            
            await asyncio.sleep(1)

asyncio.run(connect_and_run(DEVICE_ADDRESS))
