import asyncio
from bleak import BleakClient
from pycycling.fitness_machine_service import FitnessMachineService

async def run(address):
    async with BleakClient(address, timeout=10) as client:
        ftms = FitnessMachineService(client)

        # Lecture des caractéristiques disponibles
        fitness_machine_features, target_setting_features = await ftms.get_all_features()
        fitness_machine_features = fitness_machine_features._asdict()
        target_setting_features = target_setting_features._asdict()

        print("Caractéristiques de la machine :", fitness_machine_features)
        print("Caractéristiques des réglages :", target_setting_features)

        # Récupération de la plage de résistance et de puissance si supportée
        max_resistance = None
        max_power = None

        if target_setting_features["resistance_target_setting_supported"]:
            supported_resistance_level_range = await ftms.get_supported_resistance_level_range()
            max_resistance = supported_resistance_level_range.maximum_resistance
            print("Plage de résistance supportée :", supported_resistance_level_range)

        if target_setting_features["power_target_setting_supported"]:
            supported_power_range = await ftms.get_supported_power_range()
            max_power = supported_power_range.maximum_power
            print("Plage de puissance supportée :", supported_power_range)

        # Récupération du poids de l'utilisateur si disponible
        weight = None
        try:
            weight_char_uuid = "00002a98-0000-1000-8000-00805f9b34fb"  # UUID de la caractéristique du poids
            weight_data = await client.read_gatt_char(weight_char_uuid)
            weight = int.from_bytes(weight_data, byteorder="little") / 10  # Convertir en kg
            print(f"Poids détecté : {weight} kg")
        except Exception as e:
            print(f"Impossible de récupérer le poids : {e}")

        # Activation des notifications pour recevoir les données en temps réel
        def print_indoor_bike_data(data):
            print("Données du vélo indoor :", data)

        ftms.set_indoor_bike_data_handler(print_indoor_bike_data)
        await ftms.enable_indoor_bike_data_notify()

        def print_fitness_machine_status(data):
            print("Statut de la machine :", data)

        ftms.set_fitness_machine_status_handler(print_fitness_machine_status)
        await ftms.enable_fitness_machine_status_notify()

        def print_training_status(data):
            print("Statut de l'entraînement :", data)

        ftms.set_training_status_handler(print_training_status)
        await ftms.enable_training_status_notify()

        # Activation du contrôle de la machine
        await ftms.enable_control_point_indicate()
        await ftms.request_control()
        await ftms.reset()

        async def update_difficulty():
            """ Fonction permettant de modifier la difficulté en temps réel """
            while True:
                try:
                    print("\nOptions de réglage :")
                    print("1 - Modifier la résistance")
                    print("2 - Modifier la puissance")
                    print("3 - Quitter")

                    choice = input("Choisissez une option : ").strip()
                    if choice == "1" and max_resistance is not None:
                        level = float(input(f"Entrez un niveau de résistance (0-{max_resistance}): "))
                        await ftms.set_target_resistance_level(min(level, max_resistance))
                        print(f"Résistance réglée à {level}")
                    elif choice == "2" and max_power is not None:
                        power = float(input(f"Entrez une puissance (0-{max_power} W): "))
                        await ftms.set_target_power(min(power, max_power))
                        print(f"Puissance réglée à {power} W")
                    elif choice == "3":
                        print("Fin du programme.")
                        break
                    else:
                        print("Entrée invalide ou option non supportée.")
                except Exception as e:
                    print(f"Erreur lors de l'ajustement de la difficulté : {e}")

        await update_difficulty()

if __name__ == "__main__":
    device_address = "D9:45:C1:88:67:D5"
    asyncio.run(run(device_address))
