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
  const [metrics, setMetrics] = useState({ power: 0, distance: 0, revolutions: 0 });
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [speedLeaderboard, setSpeedLeaderboard] = useState([]);
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [sessionStartEnergy, setSessionStartEnergy] = useState(0);
  const [sessionStartDistance, setSessionStartDistance] = useState(0);
  const [sessionSpeedRecord, setSessionSpeedRecord] = useState(0);
  // Modes : "total", "circuit" et "leaderboard"
  const [mode, setMode] = useState("total");

  const distanceRef = useRef(0);
  const sessionStartTimeRef = useRef(null);

  useEffect(() => {
    distanceRef.current = metrics.distance;
  }, [metrics.distance]);

  useEffect(() => {
    //const socket = io("http://localhost:5001");
    //const socket = io(window.location.origin);
    const socket = io("https://michelin-bike.azurewebsites.net");
    socket.on("metrics_update", (data) => {
      setMetrics(data);
      const timeInterval = 2; // en secondes
      setTotalEnergy((prev) => prev + data.power * (timeInterval / 3600));
    });
    return () => socket.close();
  }, []);

  useEffect(() => {
    let lastTime = Date.now();
    let lastDistance = distanceRef.current;
    const interval = setInterval(() => {
      const now = Date.now();
      const deltaT = (now - lastTime) / 1000;
      const currentDistance = distanceRef.current;
      const deltaD = currentDistance - lastDistance;
      const computedSpeed = (deltaD / deltaT) * 3.6;
      setLiveSpeed(computedSpeed);
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
  }, [currentParticipant, sessionSpeedRecord]);

  const startSession = () => {
    const name = prompt("Entrez le nom et prénom du participant:");
    if (name) {
      setCurrentParticipant({ name });
      setSessionStartEnergy(totalEnergy);
      setSessionStartDistance(metrics.distance);
      setSessionSpeedRecord(0);
      sessionStartTimeRef.current = Date.now();
    }
  };

  const endSession = () => {
    if (!currentParticipant) return;
    const sessionEnergy = totalEnergy - sessionStartEnergy;
    const updatedParticipants = [
      ...participants,
      { name: currentParticipant.name, energy: sessionEnergy }
    ].sort((a, b) => b.energy - a.energy);
    setParticipants(updatedParticipants);
    const updatedSpeedLeaderboard = [
      ...speedLeaderboard,
      { name: currentParticipant.name, speed: sessionSpeedRecord }
    ].sort((a, b) => b.speed - a.speed);
    setSpeedLeaderboard(updatedSpeedLeaderboard);
    setCurrentParticipant(null);
  };

  const collectiveProgress = Math.min((totalEnergy / (OBJECTIF_KWH * 1000)) * 100, 100);
  const sessionEnergy = currentParticipant ? totalEnergy - sessionStartEnergy : 0;
  const sessionDistance = currentParticipant ? metrics.distance - sessionStartDistance : 0;

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

      {/* Mode Total : affichage global et impact collectif */}
      {mode === "total" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Carte des mesures globales */}
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-[#001C58] mb-6">⚡ Mesures Globales</h2>
            <p className="text-center text-lg">
              Puissance Actuelle : <span className="font-bold">{metrics.power} W</span>
            </p>
            <p className="text-center text-lg">
              Distance Totale : <span className="font-bold">{metrics.distance.toFixed(2)} m</span>
            </p>
            <p className="text-center text-lg">
              Énergie Totale : <span className="font-bold">{totalEnergy.toFixed(2)} Wh</span>
            </p>
          </div>
          {/* Carte de l'impact collectif avec une barre de progression améliorée */}
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
            <div className="flex justify-around mt-6">
              {COLLECTIVE_MILESTONES.map((m, idx) => {
                const percent = (m.threshold / (OBJECTIF_KWH * 1000)) * 100;
                const achieved = totalEnergy >= m.threshold;
                return (
                  <div key={idx} className="flex flex-col items-center">
                    <div className={`text-3xl ${achieved ? "opacity-100" : "opacity-50"}`}>
                      {m.icon}
                    </div>
                    <div className="text-xs font-medium text-[#001C58]">{m.title}</div>
                    <div className="text-xs text-gray-600">{percent.toFixed(0)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mode Circuit : suivi individuel */}
      {mode === "circuit" && (
        <div className="grid grid-cols-1 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-[#001C58] mb-6">🏎 Mode Circuit</h2>
            {currentParticipant ? (
              <>
                <p className="text-center mb-6">
                  Bonjour <span className="font-bold">{currentParticipant.name}</span> !<br />
                  Vous avez produit{" "}
                  <span className="font-bold">{sessionEnergy.toFixed(2)} Wh</span> durant cette session.
                </p>
                <p className="text-center mb-6">
                  Distance parcourue :{" "}
                  <span className="font-bold">{sessionDistance.toFixed(2)} m</span>
                </p>
                <div className="text-center mb-6">
                  <p className="text-xl font-bold text-[#001C58]">
                    Vitesse Actuelle : {liveSpeed.toFixed(2)} km/h
                  </p>
                </div>
                <div className="space-y-4">
                  {ENERGY_GOALS.map((goal, idx) => {
                    const progressPercent = Math.min((sessionEnergy / goal.value) * 100, 100);
                    return (
                      <div key={idx}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[#001C58] font-medium">{goal.label}</span>
                          <span className="text-sm text-gray-600">{goal.value} Wh</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                          <div
                            className="bg-[#FFCD00] h-4 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>
                        <div className="text-right text-xs text-gray-600">
                          {progressPercent.toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-8 text-center">
                  <button
                    onClick={endSession}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold uppercase transition-colors"
                  >
                    🛑 Terminer la session
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

      {/* Mode Leaderboard : affichage des classements */}
      {mode === "leaderboard" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-[#001C58] mb-6">🏁 Leaderboard des Vitesses</h2>
            {speedLeaderboard.length > 0 ? (
              <ol className="list-decimal list-inside space-y-2">
                {speedLeaderboard.slice(0, 5).map((entry, i) => (
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
                {participants.slice(0, 5).map((p, i) => (
                  <li key={i} className="text-xl text-[#001C58] font-medium">
                    {i + 1}. {p.name} - {p.energy.toFixed(2)} Wh
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-center text-gray-600">
                Aucun participant pour l’instant...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
