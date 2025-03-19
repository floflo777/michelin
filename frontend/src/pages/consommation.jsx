import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

// Même constantes que dans data.jsx
const TRANSMISSION_RATIO = 3.3;
const WHEEL_CIRCUMFERENCE = 2.1; // mètres
const TIME_INTERVAL = 2; // hypothèse de 2 s entre deux updates

// Objectif pour la barre de progression en kWh
const OBJECTIF_KWH = 5;

function Consommation() {
  // --- États principaux ---

  // On renomme "cumulativeDistance" en "traveledDistance" (pour coller à Trajet.jsx)
  const [traveledDistance, setTraveledDistance] = useState(0);

  // Les métriques brutes reçues (sauf la vitesse qu’on recalcule nous-mêmes)
  const [metrics, setMetrics] = useState({
    power: 0,
    cadence: 0,
    revolutions: 0,
  });

  // Vitesse (calculée localement)
  const [speed, setSpeed] = useState(0);

  // Énergie totale (Wh)
  const [totalEnergy, setTotalEnergy] = useState(0);

  // Leaderboard
  const [participants, setParticipants] = useState([]);
  const [speedLeaderboard, setSpeedLeaderboard] = useState([]);

  // États pour le “mode circuit”
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [sessionStartEnergy, setSessionStartEnergy] = useState(0);
  const [sessionStartDistance, setSessionStartDistance] = useState(0);
  const [sessionSpeedRecord, setSessionSpeedRecord] = useState(0);
  const [instantaneousSpeedCircuit, setInstantaneousSpeedCircuit] = useState(0);

  // Mode d’affichage : “total” / “circuit” / “leaderboard”
  const [mode, setMode] = useState("total");

  // --- Références ---
  // Pour calculer le delta de révolutions
  const prevRevolutionsRef = useRef(null);
  // Pour ignorer le premier update
  const isFirstUpdateRef = useRef(true);
  // Pour l’intégration de la puissance => énergie
  const powerRef = useRef(0);
  // Pour timer la session circuit (optionnel)
  const sessionStartTimeRef = useRef(null);

  // ----------------------------------------------
  // 1) Chargement initial depuis localStorage => "trajet"
  // ----------------------------------------------
  useEffect(() => {
    // On récupère l'objet "trajet"
    const storedTrajet = localStorage.getItem("trajet");
    if (storedTrajet) {
      const obj = JSON.parse(storedTrajet);
      // Si l'objet contient "distance", on initialise traveledDistance
      if (typeof obj.distance === "number") {
        setTraveledDistance(obj.distance);
      }
      // Si on veut restaurer prevRevolutions (si vous le stockez côté "trajet")
      if (typeof obj.prevRevolutions === "number") {
        prevRevolutionsRef.current = obj.prevRevolutions;
      }
    }

    // Récupération totalEnergy (inchangé)
    const savedEnergy = localStorage.getItem("totalEnergy");
    if (savedEnergy) {
      setTotalEnergy(parseFloat(savedEnergy));
    }

    // Récupération leaderboard (inchangé)
    const storedLB = localStorage.getItem("leaderboard");
    if (storedLB) {
      const lb = JSON.parse(storedLB);
      const sortedBySpeed = [...lb].sort((a, b) => b.speed - a.speed).slice(0, 10);
      const sortedByEnergy = [...lb].sort((a, b) => b.energy - a.energy).slice(0, 10);
      setSpeedLeaderboard(sortedBySpeed);
      setParticipants(sortedByEnergy);
    }
  }, []);

  // ----------------------------------------------
  // 2) Socket.IO => on calcule la distance via revolveDelta
  // ----------------------------------------------
  useEffect(() => {
    const socket = io(window.location.origin);

    socket.on("metrics_update", (data) => {
      if (!data) return;

      // Mémoriser la puissance
      powerRef.current = data.power ?? 0;

      // Mettre à jour nos autres métriques
      setMetrics((prev) => ({ ...prev, ...data }));

      // Calcul de la vitesse + distance
      let computedSpeed = 0;
      if (isFirstUpdateRef.current) {
        // On ignore le premier update pour éviter un delta énorme
        isFirstUpdateRef.current = false;
        prevRevolutionsRef.current = data.revolutions;
      } else {
        const revolveDelta = data.revolutions - (prevRevolutionsRef.current ?? 0);
        prevRevolutionsRef.current = data.revolutions;

        // Si revolveDelta < 0 => reset du capteur => 0
        const validDelta = Math.max(0, revolveDelta);

        // Distance supplémentaire en mètres
        const distanceDelta = validDelta * TRANSMISSION_RATIO * WHEEL_CIRCUMFERENCE;

        // Mise à jour de traveledDistance
        setTraveledDistance((prevDist) => {
          const newDist = prevDist + distanceDelta;

          // On met à jour l'objet "trajet" dans le localStorage
          const storedTrajet = localStorage.getItem("trajet");
          let trajetData = {};
          if (storedTrajet) {
            trajetData = JSON.parse(storedTrajet);
          }
          const updatedTrajet = {
            ...trajetData,
            distance: newDist,
            prevRevolutions: data.revolutions, // si besoin
          };
          localStorage.setItem("trajet", JSON.stringify(updatedTrajet));

          return newDist;
        });

        // Calcul de la vitesse (km/h) si on suppose un envoi toutes les TIME_INTERVAL secondes
        computedSpeed = (distanceDelta / TIME_INTERVAL) * 3.6;
      }
      setSpeed(computedSpeed);
    });

    return () => socket.close();
  }, []);

  // ----------------------------------------------
  // 3) Calcul de l’énergie totale (Wh) via la puissance
  // ----------------------------------------------
  useEffect(() => {
    let lastTime = Date.now();
    const maxDelta = 1.5;

    const interval = setInterval(() => {
      const now = Date.now();
      let deltaSeconds = (now - lastTime) / 1000;
      // Pour éviter une intégration trop fausse si onglet pas actif
      if (deltaSeconds > maxDelta) deltaSeconds = maxDelta;
      lastTime = now;

      setTotalEnergy((prev) => {
        // Wh = P(W) * (t / 3600)
        const addedWh = powerRef.current * (deltaSeconds / 3600);
        const newVal = prev + addedWh;
        localStorage.setItem("totalEnergy", newVal.toString());
        return newVal;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ----------------------------------------------
  // 4) Mode “Circuit” : sessionStartTime, record de vitesse, etc.
  // ----------------------------------------------
  useEffect(() => {
    if (!currentParticipant) return;

    // On actualise la "vitesse instantanée" toutes les 2 s, par ex.
    const interval = setInterval(() => {
      if (speed > sessionSpeedRecord) {
        setSessionSpeedRecord(speed);
      }
      setInstantaneousSpeedCircuit(speed);
    }, 2000);

    return () => clearInterval(interval);
  }, [currentParticipant, speed, sessionSpeedRecord]);

  const startSession = () => {
    const name = prompt("Entrez le nom du participant :");
    if (!name) return;
    setCurrentParticipant({ name });
    setSessionStartEnergy(totalEnergy);
    setSessionStartDistance(traveledDistance);
    setSessionSpeedRecord(0);
    setInstantaneousSpeedCircuit(0);
    sessionStartTimeRef.current = Date.now();
  };

  const endSession = () => {
    if (!currentParticipant) return;
    const sessionEnergy = totalEnergy - sessionStartEnergy;
    const maxSpeed = sessionSpeedRecord;

    let lb = [];
    const storedLB = localStorage.getItem("leaderboard");
    if (storedLB) lb = JSON.parse(storedLB);

    lb.push({ name: currentParticipant.name, energy: sessionEnergy, speed: maxSpeed });
    localStorage.setItem("leaderboard", JSON.stringify(lb));

    // Mise à jour de l’état local
    const sortedBySpeed = [...lb].sort((a, b) => b.speed - a.speed).slice(0, 10);
    const sortedByEnergy = [...lb].sort((a, b) => b.energy - a.energy).slice(0, 10);
    setSpeedLeaderboard(sortedBySpeed);
    setParticipants(sortedByEnergy);

    // Reset
    setCurrentParticipant(null);
    setSessionStartEnergy(0);
    setSessionStartDistance(0);
    setSessionSpeedRecord(0);
    setInstantaneousSpeedCircuit(0);
    sessionStartTimeRef.current = null;
  };

  const resetCircuitSession = () => {
    setCurrentParticipant(null);
    setSessionStartEnergy(0);
    setSessionStartDistance(0);
    setSessionSpeedRecord(0);
    setInstantaneousSpeedCircuit(0);
    sessionStartTimeRef.current = null;
  };

  // ----------------------------------------------
  // 5) Affichage : "total", "circuit", "leaderboard"
  // ----------------------------------------------
  const collectiveProgress = Math.min((totalEnergy / (OBJECTIF_KWH * 1000)) * 100, 100);

  // Distance de la session courante
  const sessionDistance = currentParticipant
    ? traveledDistance - sessionStartDistance
    : 0;
  // Énergie produite durant la session
  const sessionEnergy = currentParticipant
    ? totalEnergy - sessionStartEnergy
    : 0;

  return (
    <div className="container mx-auto p-6 text-[#4A4A4A]">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-[#001C58]">🚴 Événement Cyclisme</h1>
        <p className="mt-2 text-lg">Suivi en direct de vos performances</p>
      </header>

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

      {/* MODE TOTAL */}
      {mode === "total" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-[#001C58] mb-6">⚡ Mesures Globales</h2>
            <p className="text-center text-lg">
              Puissance Actuelle : <span className="font-bold">{metrics.power.toFixed(0)} W</span>
            </p>
            <p className="text-center text-lg">
              Cadence : <span className="font-bold">{metrics.cadence.toFixed(1)} RPM</span>
            </p>
            <p className="text-center text-lg">
              Distance Totale :{" "}
              <span className="font-bold">{traveledDistance.toFixed(2)} m</span>
            </p>
            <p className="text-center text-lg">
              Vitesse Actuelle : <span className="font-bold">{speed.toFixed(2)} km/h</span>
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
              />
              <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[#001C58]">
                {collectiveProgress.toFixed(0)}%
              </div>
            </div>
            <p className="mt-4 text-center font-semibold">
              {totalEnergy.toFixed(2)} Wh produits
            </p>
          </div>
        </div>
      )}

      {/* MODE LEADERBOARD */}
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
              <p className="text-center text-gray-600">
                Aucun participant pour l’instant...
              </p>
            )}
          </div>
        </div>
      )}

      {/* MODE CIRCUIT */}
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
                    Vitesse Instantanée : {instantaneousSpeedCircuit.toFixed(2)} km/h
                  </p>
                  <p className="text-md text-gray-500 mt-1">
                    (Record de session : {sessionSpeedRecord.toFixed(2)} km/h)
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

export default Consommation;
