import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const OBJECTIF_KWH = 5;
const ENERGY_GOALS = [
  { label: "☕ Café préparé", value: 100 },
  { label: "🍞 1 Toast grillé", value: 250 },
  { label: "📱 Téléphone chargé", value: 500 },
  { label: "💡 Ampoule LED (10h)", value: 1000 },
  { label: "🚗 Voiture électrique (10 km)", value: 2000 },
  { label: "🏡 Maison (1 jour)", value: 5000 }
];

const COLLECTIVE_MILESTONES = [
  { threshold: 1000, icon: "🌱", title: "Semis plantés" },
  { threshold: 2500, icon: "🌳", title: "Arbres replantés" },
  { threshold: 5000, icon: "🌲", title: "Don effectué" }
];

export default function Evenement() {
  // États globaux
  const [metrics, setMetrics] = useState({ power: 0, distance: 0, revolutions: 0 });
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [cumulativeDistance, setCumulativeDistance] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [speedLeaderboard, setSpeedLeaderboard] = useState([]);

  // États pour le mode Circuit
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [sessionStartEnergy, setSessionStartEnergy] = useState(0);
  const [sessionStartDistance, setSessionStartDistance] = useState(0);
  const [sessionSpeedRecord, setSessionSpeedRecord] = useState(0);

  // Mode d'affichage
  const [mode, setMode] = useState("total");

  // Références pour la distance, la puissance et le temps
  const distanceRef = useRef(null); // pour la distance cumulée
  const powerRef = useRef(0);       // stocke la dernière puissance reçue
  const sessionStartTimeRef = useRef(null);

  // Au montage, récupérer la valeur sauvegardée de totalEnergy depuis le localStorage
  useEffect(() => {
    const storedEnergy = localStorage.getItem("totalEnergy");
    if (storedEnergy !== null) {
      setTotalEnergy(parseFloat(storedEnergy));
    }
  }, []);

  // Calcul de l'énergie par intervalle en se basant sur le delta réel de temps
  useEffect(() => {
    let lastTime = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const deltaSeconds = (now - lastTime) / 1000; // temps écoulé en secondes
      lastTime = now;
      // Intégrer la puissance actuelle sur le delta en heures
      setTotalEnergy((prevEnergy) => {
        const newEnergy = prevEnergy + powerRef.current * (deltaSeconds / 3600);
        localStorage.setItem("totalEnergy", newEnergy.toString());
        return newEnergy;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Connexion Socket.IO : mise à jour des métriques, de la distance et de la puissance
  useEffect(() => {
    const socket = io(window.location.origin);
    socket.on("metrics_update", (data) => {
      if (!data) return;
      // Mise à jour de la distance cumulée (méthode identique à trajet.jsx)
      let deltaDistance = 0;
      if (distanceRef.current === null) {
        distanceRef.current = data.distance;
      } else {
        deltaDistance = data.distance - distanceRef.current;
        if (deltaDistance < 0) {
          console.warn(
            `Redémarrage détecté : distance reçue (${data.distance}) < distance actuelle (${distanceRef.current}).`
          );
          deltaDistance = 0;
        }
        distanceRef.current = data.distance;
      }
      setCumulativeDistance((prev) => prev + deltaDistance);

      // Mise à jour de la puissance
      powerRef.current = data.power;

      // Mise à jour des autres métriques
      setMetrics(data);
    });
    return () => socket.close();
  }, []);

  // Mise à jour de l'API pour les metrics et la distance uniquement
  useEffect(() => {
    fetch("https://michelin-bike.azurewebsites.net/api/impact", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "currentImpact",
        timestamp: Date.now() / 1000,
        metrics,
        distance: cumulativeDistance
      })
    })
      .then((res) => res.json())
      .then((data) => console.log("DB updated", data))
      .catch((err) => console.error("Erreur PUT /api/impact:", err));
  }, [metrics, cumulativeDistance]);

  // Récupération initiale (metrics et distance) depuis la DB
  useEffect(() => {
    fetch("https://michelin-bike.azurewebsites.net/api/impact")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.metrics) {
          setMetrics(data.metrics);
          if (data.metrics.distance !== undefined) {
            setCumulativeDistance(data.metrics.distance);
            distanceRef.current = data.metrics.distance;
          }
        }
      })
      .catch((err) => console.error("Erreur GET /api/impact:", err));
  }, []);

  // Récupération du leaderboard
  useEffect(() => {
    fetch("https://michelin-bike.azurewebsites.net/api/leaderboard")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data)) {
          const sortedBySpeed = [...data].sort((a, b) => b.speed - a.speed).slice(0, 10);
          const sortedByEnergy = [...data].sort((a, b) => b.energy - a.energy).slice(0, 10);
          setSpeedLeaderboard(sortedBySpeed);
          setParticipants(sortedByEnergy);
        }
      })
      .catch((err) => console.error("Erreur GET /api/leaderboard:", err));
  }, []);

  // Suivi en mode Circuit : calcul de la vitesse
  useEffect(() => {
    let lastTime = Date.now();
    let lastDistance = cumulativeDistance;
    const interval = setInterval(() => {
      const now = Date.now();
      const deltaT = (now - lastTime) / 1000;
      const currentDistance = cumulativeDistance;
      const deltaD = currentDistance - lastDistance;
      const computedSpeed = (deltaD / deltaT) * 3.6;
      if (
        currentParticipant &&
        sessionStartTimeRef.current &&
        now - sessionStartTimeRef.current > 5000 &&
        computedSpeed > sessionSpeedRecord
      ) {
        setSessionSpeedRecord(computedSpeed);
      }
      lastTime = now;
      lastDistance = currentDistance;
    }, 1000);
    return () => clearInterval(interval);
  }, [currentParticipant, sessionSpeedRecord, cumulativeDistance]);

  const startSession = () => {
    const name = prompt("Entrez le nom et prénom du participant:");
    if (name) {
      setCurrentParticipant({ name });
      setSessionStartEnergy(totalEnergy);
      setSessionStartDistance(cumulativeDistance);
      setSessionSpeedRecord(0);
      sessionStartTimeRef.current = Date.now();
    }
  };

  const endSession = () => {
    if (!currentParticipant) return;
    const sessionEnergy = totalEnergy - sessionStartEnergy;
    fetch("https://michelin-bike.azurewebsites.net/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: currentParticipant.name,
        energy: sessionEnergy,
        speed: sessionSpeedRecord
      })
    })
      .then((res) => res.json())
      .then(() => {
        fetch("https://michelin-bike.azurewebsites.net/api/leaderboard")
          .then((res) => res.json())
          .then((data) => {
            const sortedBySpeed = [...data].sort((a, b) => b.speed - a.speed).slice(0, 10);
            const sortedByEnergy = [...data].sort((a, b) => b.energy - a.energy).slice(0, 10);
            setSpeedLeaderboard(sortedBySpeed);
            setParticipants(sortedByEnergy);
          })
          .catch((err) => console.error("Erreur GET leaderboard après session:", err));
      })
      .catch((err) => console.error("Erreur POST /api/leaderboard:", err));
    
    setCurrentParticipant(null);
    setSessionStartEnergy(0);
    setSessionStartDistance(0);
    setSessionSpeedRecord(0);
    sessionStartTimeRef.current = null;
  };

  const resetCircuitSession = () => {
    setCurrentParticipant(null);
    setSessionStartEnergy(0);
    setSessionStartDistance(0);
    setSessionSpeedRecord(0);
    sessionStartTimeRef.current = null;
  };

  const collectiveProgress = Math.min((totalEnergy / (OBJECTIF_KWH * 1000)) * 100, 100);

  return (
    <div className="container mx-auto p-6 text-[#4A4A4A]">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-[#001C58]">🚴 Événement Cyclisme</h1>
        <p className="mt-2 text-lg">Suivi en direct de vos performances</p>
      </header>

      {/* Sélecteur de mode */}
      <div className="flex justify-center mb-8">
        <button
          onClick={() => setMode("total")}
          className={`mx-2 px-4 py-2 rounded-lg font-bold ${
            mode === "total" ? "bg-[#001C58] text-white" : "bg-gray-200 text-[#001C58]"
          }`}
        >
          Total
        </button>
        <button
          onClick={() => setMode("circuit")}
          className={`mx-2 px-4 py-2 rounded-lg font-bold ${
            mode === "circuit" ? "bg-[#001C58] text-white" : "bg-gray-200 text-[#001C58]"
          }`}
        >
          Circuit
        </button>
        <button
          onClick={() => setMode("leaderboard")}
          className={`mx-2 px-4 py-2 rounded-lg font-bold ${
            mode === "leaderboard" ? "bg-[#001C58] text-white" : "bg-gray-200 text-[#001C58]"
          }`}
        >
          Leaderboard
        </button>
      </div>

      {/* Mode Total */}
      {mode === "total" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-[#001C58] mb-6">⚡ Mesures Globales</h2>
            <p className="text-center text-lg">
              Puissance Actuelle : <span className="font-bold">{metrics.power} W</span>
            </p>
            <p className="text-center text-lg">
              Distance Totale : <span className="font-bold">{cumulativeDistance.toFixed(2)} m</span>
            </p>
            <p className="text-center text-lg">
              Énergie Totale : <span className="font-bold">{totalEnergy.toFixed(2)} Wh</span>
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-[#001C58] mb-6">🌍 Impact Collectif</h2>
            <p className="text-center mb-4 font-medium">Objectif : {OBJECTIF_KWH} kWh</p>
            <div className="relative h-8 bg-gray-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${collectiveProgress}%` }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[#001C58]">
                {collectiveProgress.toFixed(0)}%
              </div>
            </div>
            <p className="mt-4 text-center font-semibold">{totalEnergy.toFixed(2)} Wh produits</p>
          </div>
        </div>
      )}

      {/* Mode Leaderboard */}
      {mode === "leaderboard" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-[#001C58] mb-6">🏁 Leaderboard des Vitesses</h2>
            {speedLeaderboard.length > 0 ? (
              <ol className="list-decimal list-inside space-y-2">
                {speedLeaderboard.map((entry, i) => (
                  <li key={i} className="text-xl text-[#001C58] font-medium">
                    {entry.name} - {entry.speed.toFixed(2)} km/h
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-center text-gray-600">
                Aucune vitesse enregistrée pour l’instant...
              </p>
            )}
          </div>
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-[#001C58] mb-6">🏆 Leaderboard Énergie Produite</h2>
            {participants.length > 0 ? (
              <ol className="list-decimal list-inside space-y-2">
                {participants.map((p, i) => (
                  <li key={i} className="text-xl text-[#001C58] font-medium">
                    {i + 1}. {p.name} - {p.energy.toFixed(2)} Wh
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-center text-gray-600">Aucun participant pour l’instant...</p>
            )}
          </div>
        </div>
      )}

      {/* Mode Circuit */}
      {mode === "circuit" && (
        <div className="grid grid-cols-1 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-[#001C58] mb-6">🏎 Mode Circuit</h2>
            {currentParticipant ? (
              <>
                <p className="text-center mb-6">
                  Bonjour <span className="font-bold">{currentParticipant.name}</span> !<br />
                  Vous avez produit{" "}
                  <span className="font-bold">{(totalEnergy - sessionStartEnergy).toFixed(2)} Wh</span> durant cette session.
                </p>
                <p className="text-center mb-6">
                  Distance parcourue :{" "}
                  <span className="font-bold">{(cumulativeDistance - sessionStartDistance).toFixed(2)} m</span>
                </p>
                <div className="text-center mb-6">
                  <p className="text-xl font-bold text-[#001C58]">
                    Vitesse Actuelle :{" "}
                    {(
                      ((cumulativeDistance - sessionStartDistance) /
                        ((Date.now() - sessionStartTimeRef.current) / 1000)) *
                      3.6
                    ).toFixed(2)}{" "}
                    km/h
                  </p>
                </div>
                <div className="mt-8 text-center flex flex-col gap-4">
                  <button
                    onClick={endSession}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold uppercase transition-colors"
                  >
                    🛑 Terminer la session
                  </button>
                  <button
                    onClick={resetCircuitSession}
                    className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold uppercase transition-colors"
                  >
                    Nouvelle session
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Démarrez une session pour suivre vos performances.
                </p>
                <button
                  onClick={startSession}
                  className="px-6 py-3 bg-[#001C58] hover:bg-blue-900 text-white rounded-lg font-bold uppercase transition-colors"
                >
                  🚴 Démarrer la session
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
