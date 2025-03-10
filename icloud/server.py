from flask import Flask
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")  # ✅ Forcer WebSockets

@app.route("/")
def index():
    return "✅ Serveur WebSocket actif sur le port 5001"

@socketio.on("connect")
def handle_connect():
    print("✅ Un client WebSocket s'est connecté")

@socketio.on("disconnect")
def handle_disconnect():
    print("❌ Un client WebSocket s'est déconnecté")

@socketio.on("metrics_update")
def handle_metrics_update(data):
    print("📡 Données reçues du capteur :", data)
    socketio.emit("metrics_update", data)  # ✅ Rediffuser les données

if __name__ == "__main__":
    print("🚀 Démarrage du serveur WebSocket sur http://0.0.0.0:5001")
    socketio.run(app, host="0.0.0.0", port=5001, debug=True, use_reloader=False)
