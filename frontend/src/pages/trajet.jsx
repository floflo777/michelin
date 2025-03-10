import React, { useState, useEffect } from "react";
import { GoogleMap, DirectionsRenderer, Marker, useLoadScript, StreetViewPanorama } from "@react-google-maps/api";
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

  useEffect(() => {
    //const socket = io("http://localhost:5001");
    const socket = io(window.location.origin);
    socket.on("metrics_update", (data) => setTraveledDistance(data.distance));
    return () => socket.close();
  }, []);

  const calculateRoute = () => {
    if (!startLocation || !endLocation) return;
    new window.google.maps.DirectionsService().route(
      { origin: startLocation, destination: endLocation, travelMode: "BICYCLING" },
      (result, status) => {
        if (status === "OK") {
          setDirections(result);
          setTotalRouteDistance(result.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0));
          setBikePosition(result.routes[0].legs[0].start_location);
        }
      }
    );
  };

  useEffect(() => {
    if (!directions || traveledDistance >= totalRouteDistance) return;

    let remainingDistance = traveledDistance;
    let newBikePosition = directions.routes[0].legs[0].start_location;

    for (const leg of directions.routes[0].legs) {
      for (const step of leg.steps) {
        if (remainingDistance <= step.distance.value) {
          const fraction = remainingDistance / step.distance.value;
          newBikePosition = window.google.maps.geometry.spherical.interpolate(
            step.start_location,
            step.end_location,
            fraction
          );
          break;
        }
        remainingDistance -= step.distance.value;
      }
    }

    setBikePosition(newBikePosition);
  }, [traveledDistance, directions]);

  if (!isLoaded) return <p className="text-[#001C58] text-center text-xl">📍 Chargement de la carte...</p>;

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
          className="border border-gray-300 p-3 rounded-lg w-full md:w-1/2 focus:border-[#001C58]"
          onChange={(e) => setStartLocation(e.target.value)}
        />
        <input
          type="text"
          placeholder="Arrivée"
          className="border border-gray-300 p-3 rounded-lg w-full md:w-1/2 focus:border-[#001C58]"
          onChange={(e) => setEndLocation(e.target.value)}
        />
        <button
          className="bg-[#FFCD00] text-[#001C58] px-5 py-3 rounded-lg font-bold uppercase hover:bg-[#001C58] hover:text-white transition"
          onClick={calculateRoute}
        >
          🚴 Planifier
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
