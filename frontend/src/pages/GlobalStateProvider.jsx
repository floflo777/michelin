// GlobalStateProvider.jsx
import React, { createContext, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

// Crée le contexte
export const GlobalStateContext = createContext();

// Ajuste si nécessaire l'URL du socket, par exemple :
// const SOCKET_URL = "http://localhost:5001";
// ou "https://michelin-bike.azurewebsites.net";
const SOCKET_URL = window.location.origin;

/**
 * GlobalStateProvider
 * Gère la connexion Socket.IO et centralise les states pour tous les onglets/pages.
 */
export const GlobalStateProvider = ({ children }) => {
  // --- ÉTATS GLOBAUX ---

  // Métriques brutes (distance brute, puissance, etc.)
  const [metrics, setMetrics] = useState({
    power: 0,
    cadence: 0,
    distance: 0,
    revolutions: 0,
    speed: 0, // On va le recalculer nous-mêmes si besoin
  });

  // Distance cumulée (ce qu'on appelle "cumulativeDistance" dans tes pages)
  // => c'est la somme totale parcourue depuis "zéro" (ou remise à zéro par l'utilisateur).
  const [cumulativeDistance, setCumulativeDistance] = useState(0);

  // Énergie totale (Wh)
  const [totalEnergy, setTotalEnergy] = useState(0);

  // Leaderboard : on va stocker tous les records ici,
  // puis en déduire les meilleurs par vitesse ou par énergie.
  const [leaderboard, setLeaderboard] = useState([]);

  // Pour ton mode "Circuit" :
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [sessionStartEnergy, setSessionStartEnergy] = useState(0);
  const [sessionStartDistance, setSessionStartDistance] = useState(0);
  const [sessionSpeedRecord, setSessionSpeedRecord] = useState(0);

  // Pour le calcul de vitesse instantanée :
  // On va faire un timer qui, toutes les 200ms, regarde la différence de distance,
  // pour calculer la vitesse en km/h.
  const lastDistanceRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Référence pour la puissance (utile dans l’intégration en Wh).
  const powerRef = useRef(0);

  // --- CHARGEMENT INITIAL (localStorage) ---
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
      const storedImpact = localStorage.getItem("impact"); // ex. { metrics: {...}, distance: X }
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

  // --- CONNEXION SOCKET.IO ---
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on("connect", () => {
      console.log("✅ Connecté au WebSocket depuis GlobalStateProvider");
    });
    socket.on("metrics_update", (data) => {
      if (!data) return;

      // Récupération de la distance brute envoyée par le capteur
      // (cette distance repart de 0 si le capteur redémarre).
      // On va incrémenter "cumulativeDistance" seulement si la nouvelle distance capteur > ancienne.
      setMetrics((prev) => {
        return {
          ...prev,
          power: data.power ?? 0,
          cadence: data.cadence ?? 0,
          distance: data.distance ?? 0,
          revolutions: data.revolutions ?? 0,
          // speed: on peut ignorer pour l'instant,
          // on recalcule nous-mêmes plus bas si on veut.
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

  // --- MISE À JOUR DE LA DISTANCE CUMULÉE ---
  // Ici, on va comparer la metrics.distance renvoyée par le capteur
  // avec la "dernière" distance brute connue, et incrémenter seulement
  // si la valeur a augmenté.
  const lastRawDistanceRef = useRef(null);
  useEffect(() => {
    // La "distance" brute du capteur
    const rawDistance = metrics.distance;
    if (lastRawDistanceRef.current === null) {
      lastRawDistanceRef.current = rawDistance;
      return;
    }
    let delta = rawDistance - lastRawDistanceRef.current;
    if (delta < 0) {
      // Si le capteur redémarre, on ne décrémente pas
      delta = 0;
    }
    lastRawDistanceRef.current = rawDistance;

    if (delta !== 0) {
      setCumulativeDistance((prev) => {
        const newDist = prev + delta;
        // on met à jour localStorage pour persister
        localStorage.setItem("impact", JSON.stringify({
          metrics: { ...metrics }, // ou juste data.power...
          distance: newDist,
        }));
        return newDist;
      });
    }
  }, [metrics.distance]); // à chaque fois que la distance brute change

  // --- CALCUL DE VITESSE INSTANTANÉE ---
  useEffect(() => {
    let interval = null;
    interval = setInterval(() => {
      const now = Date.now();
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
        lastDistanceRef.current = cumulativeDistance;
        return;
      }
      // deltaT en secondes
      const deltaT = (now - lastTimeRef.current) / 1000;
      const deltaD = cumulativeDistance - lastDistanceRef.current;
      lastTimeRef.current = now;
      lastDistanceRef.current = cumulativeDistance;

      // Vitesse en m/s => km/h
      const speedMs = deltaD / deltaT;
      const speedKmh = speedMs * 3.6;

      // On met à jour metrics.speed
      setMetrics((prev) => ({
        ...prev,
        speed: speedKmh < 0 ? 0 : speedKmh, // just in case
      }));

      // Si on est en session "circuit", on met à jour le record
      if (currentParticipant) {
        // Au bout de quelques secondes, on peut considérer un record
        if (speedKmh > sessionSpeedRecord) {
          setSessionSpeedRecord(speedKmh);
        }
      }

    }, 200); // calcul toutes les 200 ms

    return () => {
      clearInterval(interval);
    };
  }, [cumulativeDistance, currentParticipant, sessionSpeedRecord]);

  // --- INTÉGRATION DE LA PUISSANCE EN Wh ---
  // On fait un setInterval qui, toutes les 1 s, ajoute (power(W) * 1s / 3600) en Wh
  useEffect(() => {
    let lastTime = Date.now();
    const maxDelta = 1.5; // Pour éviter un saut énorme si l'onglet est inactif
    const interval = setInterval(() => {
      const now = Date.now();
      let deltaSeconds = (now - lastTime) / 1000;
      if (deltaSeconds > maxDelta) deltaSeconds = maxDelta;
      lastTime = now;

      setTotalEnergy((prev) => {
        const incrementWh = powerRef.current * (deltaSeconds / 3600); // P(W) * t(h) => Wh
        const newVal = prev + incrementWh;
        localStorage.setItem("totalEnergy", newVal.toString());
        return newVal;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // --- GESTION DU LEADERBOARD LOCAL ---
  const updateLocalLeaderboard = (newRecord) => {
    // newRecord = { name, energy, speed }
    let newBoard = [...leaderboard, newRecord];

    // On stocke
    setLeaderboard(newBoard);
    localStorage.setItem("leaderboard", JSON.stringify(newBoard));
  };

  // --- GESTION DU MODE "CIRCUIT" ---
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
    // Énergie produite durant la session
    const sessionEnergy = totalEnergy - sessionStartEnergy;
    // Distance parcourue durant la session (optionnel si tu veux l'afficher)
    // const sessionDistance = cumulativeDistance - sessionStartDistance;

    // On enregistre dans le leaderboard
    const newRecord = {
      name: currentParticipant.name,
      energy: sessionEnergy,
      speed: sessionSpeedRecord,
    };
    updateLocalLeaderboard(newRecord);

    // Reset des states de session
    setCurrentParticipant(null);
    setSessionStartEnergy(0);
    setSessionStartDistance(0);
    setSessionSpeedRecord(0);
  };

  const resetCircuitSession = () => {
    // Juste au cas où tu veux un bouton "Nouvelle session" sans enregistrer
    setCurrentParticipant(null);
    setSessionStartEnergy(0);
    setSessionStartDistance(0);
    setSessionSpeedRecord(0);
  };

  // --- COMPOSE LES DEUX CLASSEMENTS SÉPARÉS ---
  // 1) tri par vitesse
  const topSpeedLeaderboard = [...leaderboard]
    .sort((a, b) => b.speed - a.speed)
    .slice(0, 10);
  // 2) tri par énergie
  const topEnergyLeaderboard = [...leaderboard]
    .sort((a, b) => b.energy - a.energy)
    .slice(0, 10);

  // --- VALEURS EXPOSÉES DANS LE CONTEXTE ---
  const contextValue = {
    // Les métriques "brutes" + la vitesse calculée
    metrics,             // { power, cadence, distance(brute), speed, ... }
    cumulativeDistance,  // la distance cumulée
    totalEnergy,         // l’énergie cumulée
    currentParticipant,
    sessionStartEnergy,
    sessionStartDistance,
    sessionSpeedRecord,

    // Pour le leaderboard
    topSpeedLeaderboard,
    topEnergyLeaderboard,

    // Fonctions pour gérer la session
    startSession,
    endSession,
    resetCircuitSession,

    // Si on veut un accès direct:
    updateLocalLeaderboard, // au besoin
  };

  return (
    <GlobalStateContext.Provider value={contextValue}>
      {children}
    </GlobalStateContext.Provider>
  );
};
