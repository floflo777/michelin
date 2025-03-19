import React, { useState, useEffect, useRef } from "react";
import { GoogleMap, DirectionsRenderer, Marker, useLoadScript } from "@react-google-maps/api";
import { io } from "socket.io-client";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const mapContainerStyle = { width: "100%", height: "500px", borderRadius: "12px" };
const defaultCenter = { lat: 48.8566, lng: 2.3522 };
const bicycleIcon = "https://maps.gstatic.com/mapfiles/ms2/micons/cycling.png";

export default function Trajet() {
  const { isLoaded } = useLoadScript({ googleMapsApiKey: API_KEY, libraries: ["geometry"] });
  
  const [directions, setDirections] = useState(null);
  const [totalRouteDistance, setTotalRouteDistance] = useState(1);
  const [bikePosition, setBikePosition] = useState(null);
  const [traveledDistance, setTraveledDistance] = useState(0);
  const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const [trajetActive, setTrajetActive] = useState(false);
  // Référence pour mémoriser la dernière valeur de distance envoyée par le socket
  const lastSocketDistanceRef = useRef(null);

  const API_URL = "https://michelin-bike.azurewebsites.net/api/trajet";

  // 1. Charger le trajet sauvegardé au montage (document "currentTrajet")
  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.startLocation && data.endLocation && typeof data.distance === "number") {
          setStartLocation(data.startLocation);
          setEndLocation(data.endLocation);
          setTraveledDistance(data.distance);
          // IMPORTANT : initialiser la référence avec la distance déjà cumulée
          lastSocketDistanceRef.current = data.distance;
          setTrajetActive(true);
          recalcRoute(data.startLocation, data.endLocation);
        }
      })
      .catch((err) => console.error("Erreur GET /api/trajet:", err));
  }, []);

  // 2. Si le trajet n'est pas actif et que les champs sont renseignés, recalculer la route
  useEffect(() => {
    if (!trajetActive && startLocation && endLocation) {
      recalcRoute(startLocation, endLocation);
    }
  }, [startLocation, endLocation, trajetActive]);

  // 3. Connexion au socket pour recevoir les mises à jour de distance
  useEffect(() => {
    const socket = io(window.location.origin);
    socket.on("metrics_update", (data) => {
      if (typeof data.distance === "number") {
        let delta = 0;
        if (lastSocketDistanceRef.current === null) {
          // Première réception après réinitialisation du site : initialisation de la référence sans incrémenter
          lastSocketDistanceRef.current = data.distance;
        } else {
          // Calcul du delta entre la nouvelle valeur et la précédente
          delta = data.distance - lastSocketDistanceRef.current;
          lastSocketDistanceRef.current = data.distance;
          if (delta < 0) delta = 0; // Pour éviter une décrémentation inattendue
        }
        // Mettre à jour la distance cumulée uniquement avec le delta
        setTraveledDistance((prevDistance) => {
          const newDistance = prevDistance + delta;
          // Mise à jour de l'API avec la nouvelle distance cumulée
          fetch(API_URL, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              startLocation,
              endLocation,
              distance: newDistance,
              timestamp: Date.now()
            })
          })
            .then((res) => res.json())
            .then((apiData) => console.log("Trajet mis à jour:", apiData))
            .catch((err) => console.error("Erreur PUT /api/trajet:", err));
          return newDistance;
        });
      }
    });
    return () => socket.close();
  }, [startLocation, endLocation]);

  // 4. Fonction pour recalculer la route via l'API Google Directions
  const recalcRoute = (origin, destination) => {
    new window.google.maps.DirectionsService().route(
      { origin, destination, travelMode: "BICYCLING" },
      (result, status) => {
        if (status === "OK") {
          setDirections(result);
          // Calcul de la distance totale théorique du trajet
          const computedDistance = result.routes[0].legs.reduce(
            (sum, leg) => sum + leg.distance.value,
            0
          );
          setTotalRouteDistance(computedDistance);
          // Position initiale du vélo
          setBikePosition(result.routes[0].legs[0].start_location);
        } else {
          console.error("Erreur lors du calcul de la route:", status);
        }
      }
    );
  };

  // 5. Mettre à jour la position du vélo en fonction de traveledDistance
  useEffect(() => {
    if (!directions || traveledDistance >= totalRouteDistance) return;
    let remaining = traveledDistance;
    let pos = directions.routes[0].legs[0].start_location;
    for (const leg of directions.routes[0].legs) {
      for (const step of leg.steps) {
        if (remaining <= step.distance.value) {
          const fraction = remaining / step.distance.value;
          pos = window.google.maps.geometry.spherical.interpolate(
            step.start_location,
            step.end_location,
            fraction
          );
          remaining = 0;
          break;
        }
        remaining -= step.distance.value;
      }
      if (remaining <= 0) break;
    }
    setBikePosition(pos);
  }, [traveledDistance, directions, totalRouteDistance]);

  // 6. Fonction de réinitialisation du trajet (DELETE du document et réinitialisation des états)
  const resetTrajet = () => {
    fetch(API_URL, { method: "DELETE" })
      .then((res) => res.json())
      .then((data) => {
        console.log("Trajet réinitialisé:", data);
        setTrajetActive(false);
        setStartLocation("");
        setEndLocation("");
        setDirections(null);
        setTotalRouteDistance(1);
        setBikePosition(null);
        setTraveledDistance(0);
        lastSocketDistanceRef.current = null; // Réinitialiser la référence
      })
      .catch((err) => console.error("Erreur DELETE /api/trajet:", err));
  };

  if (!isLoaded)
    return <p className="text-[#001C58] text-center text-xl">📍 Chargement de la carte...</p>;

  return (
    <div className="container mx-auto p-10 text-[#4A4A4A]">
      <h2 className="text-3xl font-bold uppercase tracking-tight text-[#001C58] text-center mb-6">
        🚴 Suivi de votre Trajet
      </h2>
      <p className="text-center text-lg mb-8">
        Planifiez votre itinéraire et suivez votre progression en direct.
      </p>
      
      <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Départ"
          value={startLocation}
          className="border border-gray-300 p-3 rounded-lg w-full md:w-1/2 focus:border-[#001C58]"
          onChange={(e) => setStartLocation(e.target.value)}
          disabled={trajetActive}
        />
        <input
          type="text"
          placeholder="Arrivée"
          value={endLocation}
          className="border border-gray-300 p-3 rounded-lg w-full md:w-1/2 focus:border-[#001C58]"
          onChange={(e) => setEndLocation(e.target.value)}
          disabled={trajetActive}
        />
        <button
          className="bg-[#FFCD00] text-[#001C58] px-5 py-3 rounded-lg font-bold uppercase hover:bg-[#001C58] hover:text-white transition"
          onClick={() => {
            recalcRoute(startLocation, endLocation);
            if (!trajetActive) {
              const initialTrajet = {
                startLocation,
                endLocation,
                distance: 0,
                timestamp: Date.now()
              };
              fetch(API_URL, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(initialTrajet)
              })
                .then((res) => res.json())
                .then((data) => {
                  console.log("Trajet sauvegardé initialement:", data);
                  setTrajetActive(true);
                })
                .catch((err) => console.error("Erreur PUT initial:", err));
            }
          }}
          disabled={trajetActive}
        >
          🚴 Planifier
        </button>
        <button
          className="bg-red-500 text-white px-5 py-3 rounded-lg font-bold uppercase hover:bg-red-600 transition"
          onClick={resetTrajet}
        >
          Réinitialiser Trajet
        </button>
      </div>

      <div className="bg-white p-6 shadow-md border border-gray-200 rounded-lg">
        <GoogleMap mapContainerStyle={mapContainerStyle} zoom={12} center={defaultCenter}>
          {directions && <DirectionsRenderer directions={directions} />}
          {bikePosition && <Marker position={bikePosition} icon={bicycleIcon} />}
        </GoogleMap>
      </div>

      <div className="bg-white p-6 shadow-md border border-gray-200 rounded-lg mt-6 text-center">
        <h3 className="text-lg font-semibold uppercase text-[#001C58] mb-2">📊 Progression</h3>
        <p>🚴 Distance parcourue : {traveledDistance.toFixed(2)} m</p>
        <p>📍 Distance totale : {totalRouteDistance.toFixed(2)} m</p>
      </div>
    </div>
  );
}
