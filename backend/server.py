import os
from flask import Flask, send_from_directory
from flask_socketio import SocketIO

app = Flask(__name__, static_folder="dist", static_url_path="")

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

@app.route("/")
def index():
    return send_from_directory("dist", "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("dist", path)

@socketio.on("connect")
def handle_connect():
    print("✅ Un client WebSocket s'est connecté")

@socketio.on("disconnect")
def handle_disconnect():
    print("❌ Un client WebSocket s'est déconnecté")

@socketio.on("metrics_update")
def handle_metrics_update(data):
    print("📡 Données reçues du capteur :", data)
    # Rediffuser à tous les clients connectés
    socketio.emit("metrics_update", data)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 80))
    print(f"🚀 Démarrage du serveur WebSocket sur http://0.0.0.0:{port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=True, use_reloader=False)
