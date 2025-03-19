# db.py
"""from azure.cosmos import CosmosClient, PartitionKey, exceptions
import uuid
import time

# Configuration Cosmos DB (remplace les valeurs par tes identifiants)
COSMOS_ENDPOINT = "https://florent.documents.azure.com:443/"
COSMOS_KEY = "pMt1lZ837GasIqSuBdhR0xyJW87rlbhv3f2LGpIoxf8yvpgRa3eDJjrTh6RK4sVtzQVVRmTwkvbsACDbtT3UQQ=="
DATABASE_ID = "bikeAppDB"

# Noms des containers
CONTAINER_TRAJET = "trajet"
CONTAINER_IMPACT = "impact"
CONTAINER_REALTIME = "realtime"
CONTAINER_LEADERBOARD = "leaderboard"

client = CosmosClient(COSMOS_ENDPOINT, COSMOS_KEY)
database = client.create_database_if_not_exists(id=DATABASE_ID)

# Création (ou récupération) des containers
trajet_container = database.create_container_if_not_exists(
    id=CONTAINER_TRAJET,
    partition_key=PartitionKey(path="/id"),
    offer_throughput=400
)

impact_container = database.create_container_if_not_exists(
    id=CONTAINER_IMPACT,
    partition_key=PartitionKey(path="/id"),
    offer_throughput=400
)

realtime_container = database.create_container_if_not_exists(
    id=CONTAINER_REALTIME,
    partition_key=PartitionKey(path="/id"),
    offer_throughput=400
)

leaderboard_container = database.create_container_if_not_exists(
    id=CONTAINER_LEADERBOARD,
    partition_key=PartitionKey(path="/id"),
    offer_throughput=400
)

def upsert_impact(data, update_total_energy=False):
    try:
        # On tente de récupérer le document existant
        existing = impact_container.read_item(item="currentImpact", partition_key="currentImpact")
        current_total_energy = existing.get("totalEnergy", 0)
    except Exception:
        current_total_energy = 0

    document = {
        "id": "currentImpact",
        "timestamp": time.time(),
        "metrics": data.get("metrics", data),  # Au cas où data serait directement le dict metrics
        "totalEnergy": data.get("totalEnergy") if update_total_energy and "totalEnergy" in data else current_total_energy
    }
    impact_container.upsert_item(document)


def insert_realtime(metrics):
    document = {
        "id": str(uuid.uuid4()),
        "timestamp": time.time(),
        "metrics": metrics
    }
    realtime_container.create_item(document)

def get_realtime(limit=100):
    query = f"SELECT * FROM c ORDER BY c.timestamp DESC OFFSET 0 LIMIT {limit}"
    items = list(realtime_container.query_items(query=query, enable_cross_partition_query=True))
    return items

def insert_trajet(data):
    data["id"] = str(uuid.uuid4())
    if "timestamp" not in data:
        data["timestamp"] = time.time()
    trajet_container.create_item(data)

def get_trajet():
    query = "SELECT * FROM c ORDER BY c.timestamp DESC OFFSET 0 LIMIT 1"
    items = list(trajet_container.query_items(query=query, enable_cross_partition_query=True))
    return items[0] if items else None

def insert_leaderboard(data):
    data["id"] = str(uuid.uuid4())
    if "timestamp" not in data:
        data["timestamp"] = time.time()
    leaderboard_container.create_item(data)

def get_leaderboard():
    query = "SELECT * FROM c ORDER BY c.timestamp DESC"
    items = list(leaderboard_container.query_items(query=query, enable_cross_partition_query=True))
    return items

def upsert_trajet(data):
    # Utiliser un ID fixe pour le trajet en cours
    data["id"] = "currentTrajet"
    if "timestamp" not in data:
        data["timestamp"] = time.time()
    trajet_container.upsert_item(data)"""
