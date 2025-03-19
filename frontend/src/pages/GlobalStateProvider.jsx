import React, { createContext, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

export const GlobalStateContext = createContext();

const SOCKET_URL = window.location.origin;

export const GlobalStateProvider = ({ children }) => {
  const [metrics, setMetrics] = useState({
    power: 0,
    cadence: 0,
    distance: 0,
    revolutions: 0,
    speed: 0, 
  });
  const [cumulativeDistance, setCumulativeDistance] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [sessionStartEnergy, setSessionStartEnergy] = useState(0);
  const [sessionStartDistance, setSessionStartDistance] = useState(0);
  const [sessionSpeedRecord, setSessionSpeedRecord] = useState(0);
  const lastDistanceRef = useRef(null);
  const lastTimeRef = useRef(null);
  const powerRef = useRef(0);

  useEffect(() => {
    try {
      const storedEnergy = localStorage.getItem("totalEnergy");
      if (storedEnergy !== null) {
        setTotalEnergy(parseFloat(storedEnergy));
      }
      const storedLeaderboard = localStorage.getItem("leaderboard");
      if (storedLeaderboard) {
        setLeaderboard(JSON.parse(storedLeaderboard));
      }
      const storedImpact = localStorage.getItem("impact"); 
      if (storedImpact) {
        const impact = JSON.parse(storedImpact);
        if (impact.metrics) {
          setMetrics((prev) => ({ ...prev, ...impact.metrics }));
        }
        if (impact.distance !== undefined) {
          setCumulativeDistance(impact.distance);
        }
      }
    } catch (err) {
      console.error("Erreur de chargement depuis localStorage:", err);
    }
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on("connect", () => {
      console.log("✅ Connecté au WebSocket depuis GlobalStateProvider");
    });
    socket.on("metrics_update", (data) => {
      if (!data) return;
      setMetrics((prev) => {
        return {
          ...prev,
          power: data.power ?? 0,
          cadence: data.cadence ?? 0,
          distance: data.distance ?? 0,
          revolutions: data.revolutions ?? 0,
        };
      });
      powerRef.current = data.power ?? 0;
    });

    socket.on("disconnect", () => {
      console.log("❌ Déconnecté du WebSocket");
    });

    return () => {
      socket.close();
    };
  }, []);

  const lastRawDistanceRef = useRef(null);
  useEffect(() => {
    const rawDistance = metrics.distance;
    if (lastRawDistanceRef.current === null) {
      lastRawDistanceRef.current = rawDistance;
      return;
    }
    let delta = rawDistance - lastRawDistanceRef.current;
    if (delta < 0) {
      delta = 0;
    }
    lastRawDistanceRef.current = rawDistance;

    if (delta !== 0) {
      setCumulativeDistance((prev) => {
        const newDist = prev + delta;
        localStorage.setItem("impact", JSON.stringify({
          metrics: { ...metrics }, 
          distance: newDist,
        }));
        return newDist;
      });
    }
  }, [metrics.distance]);

  useEffect(() => {
    let interval = null;
    interval = setInterval(() => {
      const now = Date.now();
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
        lastDistanceRef.current = cumulativeDistance;
        return;
      }
      const deltaT = (now - lastTimeRef.current) / 1000;
      const deltaD = cumulativeDistance - lastDistanceRef.current;
      lastTimeRef.current = now;
      lastDistanceRef.current = cumulativeDistance;
      const speedMs = deltaD / deltaT;
      const speedKmh = speedMs * 3.6;

      setMetrics((prev) => ({
        ...prev,
        speed: speedKmh < 0 ? 0 : speedKmh, 
      }));
      if (currentParticipant) {
        if (speedKmh > sessionSpeedRecord) {
          setSessionSpeedRecord(speedKmh);
        }
      }

    }, 200);

    return () => {
      clearInterval(interval);
    };
  }, [cumulativeDistance, currentParticipant, sessionSpeedRecord]);

  useEffect(() => {
    let lastTime = Date.now();
    const maxDelta = 1.5; 
    const interval = setInterval(() => {
      const now = Date.now();
      let deltaSeconds = (now - lastTime) / 1000;
      if (deltaSeconds > maxDelta) deltaSeconds = maxDelta;
      lastTime = now;

      setTotalEnergy((prev) => {
        const incrementWh = powerRef.current * (deltaSeconds / 3600);
        const newVal = prev + incrementWh;
        localStorage.setItem("totalEnergy", newVal.toString());
        return newVal;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const updateLocalLeaderboard = (newRecord) => {
    let newBoard = [...leaderboard, newRecord];
    setLeaderboard(newBoard);
    localStorage.setItem("leaderboard", JSON.stringify(newBoard));
  };

  const startSession = () => {
    const name = prompt("Entrez le nom et prénom du participant :");
    if (!name) return;
    setCurrentParticipant({ name });
    setSessionStartEnergy(totalEnergy);
    setSessionStartDistance(cumulativeDistance);
    setSessionSpeedRecord(0);
  };

  const endSession = () => {
    if (!currentParticipant) return;
    const sessionEnergy = totalEnergy - sessionStartEnergy;
    const newRecord = {
      name: currentParticipant.name,
      energy: sessionEnergy,
      speed: sessionSpeedRecord,
    };
    updateLocalLeaderboard(newRecord);
    setCurrentParticipant(null);
    setSessionStartEnergy(0);
    setSessionStartDistance(0);
    setSessionSpeedRecord(0);
  };

  const resetCircuitSession = () => {
    setCurrentParticipant(null);
    setSessionStartEnergy(0);
    setSessionStartDistance(0);
    setSessionSpeedRecord(0);
  };

  const topSpeedLeaderboard = [...leaderboard]
    .sort((a, b) => b.speed - a.speed)
    .slice(0, 10);
  const topEnergyLeaderboard = [...leaderboard]
    .sort((a, b) => b.energy - a.energy)
    .slice(0, 10);

  const contextValue = {
    metrics,             
    cumulativeDistance,  
    totalEnergy,     
    currentParticipant,
    sessionStartEnergy,
    sessionStartDistance,
    sessionSpeedRecord,
    topSpeedLeaderboard,
    topEnergyLeaderboard,
    startSession,
    endSession,
    resetCircuitSession,
    updateLocalLeaderboard,
  };

  return (
    <GlobalStateContext.Provider value={contextValue}>
      {children}
    </GlobalStateContext.Provider>
  );
};
