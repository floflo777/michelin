import React, { useState, useEffect, useRef } from "react";
import { Line } from "react-chartjs-2";
import { io } from "socket.io-client";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const TRANSMISSION_RATIO = 3.3; 
const WHEEL_CIRCUMFERENCE = 2.1; 
const TIME_INTERVAL = 2; 

export default function Data() {
  const [metrics, setMetrics] = useState({ power: 0, cadence: 0, distance: 0, revolutions: 0, speed: 0 });
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [
      {
        label: "Puissance (W)",
        data: [],
        borderColor: "#FFCD00",
        backgroundColor: "rgba(255,205,0,0.2)",
      },
      {
        label: "Cadence (RPM)",
        data: [],
        borderColor: "#001C58",
        backgroundColor: "rgba(0,28,88,0.2)",
      },
      {
        label: "Vitesse (km/h)",
        data: [],
        borderColor: "#000000",
        backgroundColor: "rgba(0,0,0,0.2)",
      },
    ],
  });

  const prevRevolutionsRef = useRef(null);
  const isFirstUpdate = useRef(true);

  useEffect(() => {
    const socket = io("https://michelin-bike.azurewebsites.net");
    socket.on("metrics_update", (data) => {
      let computedSpeed = 0;
      if (isFirstUpdate.current) {
        isFirstUpdate.current = false;
      } else {
        const revolutionDelta = data.revolutions - prevRevolutionsRef.current;
        computedSpeed = (revolutionDelta * TRANSMISSION_RATIO * WHEEL_CIRCUMFERENCE / TIME_INTERVAL) * 3.6;
      }
      prevRevolutionsRef.current = data.revolutions;

      const updatedMetrics = { ...data, speed: computedSpeed };
      setMetrics(updatedMetrics);

      setChartData((prev) => ({
        labels: [...prev.labels, new Date().toLocaleTimeString()].slice(-30),
        datasets: [
          { ...prev.datasets[0], data: [...prev.datasets[0].data, Math.abs(data.power)].slice(-30) },
          { ...prev.datasets[1], data: [...prev.datasets[1].data, data.cadence].slice(-30) },
          { ...prev.datasets[2], data: [...prev.datasets[2].data, computedSpeed].slice(-30) },
        ],
      }));
    });
    return () => socket.close();
  }, []);

  const metricsItems = [
    { icon: "⚡", label: "Puissance", value: `${Math.abs(metrics.power)} W` },
    { icon: "🚴", label: "Cadence", value: `${metrics.cadence} RPM` },
    { icon: "📏", label: "Distance", value: `${metrics.distance.toFixed(2)} m` },
    { icon: "🏎️", label: "Vitesse", value: `${metrics.speed.toFixed(2)} km/h` },
  ];

  return (
    <div className="container mx-auto p-10 text-[#4A4A4A]">
      <h2 className="text-3xl font-bold uppercase tracking-tight text-[#001C58] text-center mb-6">
        📊 Données en Temps Réel
      </h2>
      <p className="text-center text-lg mb-8">
        Consultez en direct l'évolution de votre puissance, cadence et vitesse.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        {metricsItems.map((item, i, arr) => (
          <div
            key={i}
            className={`bg-white p-6 shadow-md border border-gray-200 rounded-lg text-center ${
              arr.length % 3 === 1 && i === arr.length - 1 ? "lg:col-start-2" : ""
            }`}
          >
            <h3 className="text-lg font-semibold text-[#001C58] uppercase">
              {item.icon} {item.label}
            </h3>
            <p className="text-2xl">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 shadow-md border border-gray-200 rounded-lg mt-6">
        <h3 className="text-lg font-semibold uppercase text-[#001C58] mb-4">
          📉 Évolution des Données
        </h3>
        <Line data={chartData} />
      </div>
    </div>
  );
}
