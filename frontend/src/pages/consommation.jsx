import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const TRANSMISSION_RATIO = 3.3;
const WHEEL_CIRCUMFERENCE = 2.1;
const TIME_INTERVAL = 2;
const OBJECTIF_KWH = 5;

const COLLECTIVE_MILESTONES = [
  { threshold: 10, icon: "📱", title: "Charger un telephone" },
  { threshold: 20, icon: "💡", title: "Allumer une LED pour une session de travail" },
  { threshold: 30, icon: "☕", title: "Un café à la machine" },
  { threshold: 40, icon: "🍞", title: "Faire griller un toast le matin" }
];


function Consommation() {
  const [traveledDistance, setTraveledDistance] = useState(0);
  const [metrics, setMetrics] = useState({ power: 0, cadence: 0, revolutions: 0 });
  const [speed, setSpeed] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [speedLeaderboard, setSpeedLeaderboard] = useState([]);
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [sessionStartEnergy, setSessionStartEnergy] = useState(0);
  const [sessionStartDistance, setSessionStartDistance] = useState(0);
  const [sessionSpeedRecord, setSessionSpeedRecord] = useState(0);
  const [instantaneousSpeedCircuit, setInstantaneousSpeedCircuit] = useState(0);
  const [mode, setMode] = useState("total");

  const prevRevolutionsRef = useRef(null);
  const isFirstUpdateRef = useRef(true);
  const powerRef = useRef(0);
  const sessionStartTimeRef = useRef(null);

  useEffect(() => {
    const storedTrajet = localStorage.getItem("trajet");
    if (storedTrajet) {
      const obj = JSON.parse(storedTrajet);
      if (typeof obj.distance === "number") setTraveledDistance(obj.distance);
      if (typeof obj.prevRevolutions === "number") {
        prevRevolutionsRef.current = obj.prevRevolutions;
      }
    }
    const savedEnergy = localStorage.getItem("totalEnergy");
    if (savedEnergy) setTotalEnergy(parseFloat(savedEnergy));
    const storedLB = localStorage.getItem("leaderboard");
    if (storedLB) {
      const lb = JSON.parse(storedLB);
      const sortedBySpeed = [...lb].sort((a, b) => b.speed - a.speed).slice(0, 10);
      const sortedByEnergy = [...lb].sort((a, b) => b.energy - a.energy).slice(0, 10);
      setSpeedLeaderboard(sortedBySpeed);
      setParticipants(sortedByEnergy);
    }
  }, []);

  useEffect(() => {
    const socket = io("https://michelin-bike.azurewebsites.net");
    socket.on("metrics_update", (data) => {
      if (!data) return;
      powerRef.current = data.power ?? 0;
      setMetrics((prev) => ({ ...prev, ...data }));
      let computedSpeed = 0;
      if (isFirstUpdateRef.current) {
        isFirstUpdateRef.current = false;
        prevRevolutionsRef.current = data.revolutions;
      } else {
        const revolveDelta = data.revolutions - (prevRevolutionsRef.current ?? 0);
        prevRevolutionsRef.current = data.revolutions;
        const validDelta = Math.max(0, revolveDelta);
        const distanceDelta = validDelta * TRANSMISSION_RATIO * WHEEL_CIRCUMFERENCE;
        setTraveledDistance((prevDist) => {
          const newDist = prevDist + distanceDelta;
          const storedTrajet = localStorage.getItem("trajet");
          let trajetData = {};
          if (storedTrajet) trajetData = JSON.parse(storedTrajet);
          const updatedTrajet = {
            ...trajetData,
            distance: newDist,
            prevRevolutions: data.revolutions,
          };
          localStorage.setItem("trajet", JSON.stringify(updatedTrajet));
          return newDist;
        });
        computedSpeed = (distanceDelta / TIME_INTERVAL) * 3.6;
      }
      setSpeed(computedSpeed);
    });
    return () => socket.close();
  }, []);

  useEffect(() => {
    let lastTime = Date.now();
    const maxDelta = 1.5;
    const interval = setInterval(() => {
      const now = Date.now();
      let deltaSeconds = (now - lastTime) / 1000;
      if (deltaSeconds > maxDelta) deltaSeconds = maxDelta;
      lastTime = now;
      setTotalEnergy((prev) => {
        const addedWh = powerRef.current * (deltaSeconds / 3600);
        const newVal = prev + addedWh;
        localStorage.setItem("totalEnergy", newVal.toString());
        return newVal;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentParticipant) return;
    const interval = setInterval(() => {
      if (speed > sessionSpeedRecord) setSessionSpeedRecord(speed);
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
    const sortedBySpeed = [...lb].sort((a, b) => b.speed - a.speed).slice(0, 10);
    const sortedByEnergy = [...lb].sort((a, b) => b.energy - a.energy).slice(0, 10);
    setSpeedLeaderboard(sortedBySpeed);
    setParticipants(sortedByEnergy);
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

  const collectiveProgress = Math.min((totalEnergy / (OBJECTIF_KWH * 1000)) * 100, 100);
  const sessionDistance = currentParticipant ? traveledDistance - sessionStartDistance : 0;
  const sessionEnergy = currentParticipant ? totalEnergy - sessionStartEnergy : 0;

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

      {mode === "total" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold text-[#001C58] mb-6">⚡ Mesures Globales</h2>
            <p className="text-center text-xl">
              Distance Totale : <span className="font-semibold">{traveledDistance.toFixed(2)} m</span>
            </p>
            <p className="text-center text-xl">
              Puissance : <span className="font-semibold">{metrics.power.toFixed(0)} W</span>
            </p>
            <p className="text-center text-xl">
              Vitesse : <span className="font-semibold">{speed.toFixed(2)} km/h</span>
            </p>
            <p className="text-center text-xl">
              Cadence : <span className="font-semibold">{metrics.cadence.toFixed(1)} RPM</span>
            </p>
            <p className="text-center text-xl">
              Énergie Totale : <span className="font-semibold">{totalEnergy.toFixed(2)} Wh</span>
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold text-[#001C58] mb-6">🌍 Impact Collectif</h2>
            <p className="text-center mb-4 text-xl font-medium">Objectif : {OBJECTIF_KWH} kWh</p>
            <div className="relative h-8 bg-gray-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${collectiveProgress}%` }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[#001C58]">
                {collectiveProgress.toFixed(0)}%
              </div>
            </div>
            <p className="mt-4 text-center text-xl font-semibold">
              {totalEnergy.toFixed(2)} Wh produits
            </p>
          </div>
        </div>
      )}

      {mode === "leaderboard" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold text-[#001C58] mb-6">🏁 Leaderboard des Vitesses</h2>
            {speedLeaderboard.length > 0 ? (
              <ol className="list-decimal list-inside space-y-2 text-xl">
                {speedLeaderboard.map((entry, i) => (
                  <li key={i} className="text-[#001C58] font-medium">
                    {entry.name} - {entry.speed.toFixed(2)} km/h
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-center text-gray-600">Aucune vitesse enregistrée pour l’instant...</p>
            )}
          </div>
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold text-[#001C58] mb-6">🏆 Leaderboard Énergie Produite</h2>
            {participants.length > 0 ? (
              <ol className="list-decimal list-inside space-y-2 text-xl">
                {participants.map((p, i) => (
                  <li key={i} className="text-[#001C58] font-medium">
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

      {mode === "circuit" && (
        <div className="grid grid-cols-1 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold text-[#001C58] mb-6">🏎 Mode Circuit</h2>

            {currentParticipant ? (
              <>
                <div className="flex flex-col items-center mb-8">
                  <p className="text-xl text-gray-700 mb-2">
                    Bonjour <span className="font-semibold text-[#001C58]">{currentParticipant.name}</span> !
                  </p>
                  <div className="flex w-full flex-wrap justify-center gap-6">
                    <div className="flex flex-col items-center">
                      <p className="text-xl font-bold text-[#001C58]">Distance</p>
                      <p className="text-2xl font-semibold text-[#001C58]">
                        {sessionDistance.toFixed(2)} m
                      </p>
                    </div>
                    <div className="flex flex-col items-center">
                      <p className="text-xl font-bold text-[#001C58]">Production</p>
                      <p className="text-2xl font-semibold text-[#001C58]">
                        {sessionEnergy.toFixed(2)} Wh
                      </p>
                    </div>
                    <div className="flex flex-col items-center">
                      <p className="text-xl font-bold text-[#001C58]">Vitesse</p>
                      <p className="text-2xl font-semibold text-[#001C58]">
                        {instantaneousSpeedCircuit.toFixed(2)} km/h
                      </p>
                      <p className="text-sm text-gray-500">
                        (Record : {sessionSpeedRecord.toFixed(2)} km/h)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-100 p-4 rounded-xl mb-6">
                  <h3 className="text-xl font-bold text-[#001C58] mb-4 text-center">
                    Progression de la session
                  </h3>
                  <div className="relative w-full h-6 bg-gray-300 rounded-full">
                    <div
                      className="absolute left-0 top-0 h-6 bg-[#001C58] rounded-full transition-all"
                      style={{
                        width: `${Math.min((sessionEnergy / COLLECTIVE_MILESTONES[2].threshold) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-around mt-6">
                  {COLLECTIVE_MILESTONES.map((m, idx) => {
                    const progress = Math.min((sessionEnergy / m.threshold) * 100, 100);
                    const achieved = sessionEnergy >= m.threshold;
                    return (
                      <div key={idx} className="flex flex-col items-center">
                        <div className={`text-4xl mb-1 ${achieved ? "opacity-100" : "opacity-50"}`}>
                          {m.icon}
                        </div>
                        <div className="text-sm font-semibold text-[#001C58]">{m.title}</div>
                        <div className="text-xs text-gray-600">{progress.toFixed(0)}%</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 text-center flex flex-col gap-4">
                  <button
                    onClick={endSession}
                    className="px-6 py-3 bg-[#001C58] hover:bg-blue-900 text-white rounded-lg font-bold uppercase transition-colors"
                  >
                    🛑 Terminer la session
                  </button>
                  <button
                    onClick={resetCircuitSession}
                    className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-bold uppercase transition-colors"
                  >
                    Nouvelle session
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-gray-600 mb-4 text-xl">
                  Démarrez une session pour suivre vos performances.
                </p>
                <button
                  onClick={startSession}
                  className="px-6 py-3 bg-[#001C58] hover:bg-blue-900 text-white rounded-lg font-bold uppercase transition-colors text-xl"
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
