import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="container mx-auto p-10 text-[#4A4A4A]">
      <h1 className="text-4xl font-bold uppercase tracking-tight text-[#001C58] text-center mb-6">
        🚴‍♂️ Tableau de Bord Cyclisme
      </h1>
      <p className="text-center text-lg mb-10">
        Suivez vos performances et données en temps réel avec précision.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { to: "/trajet", label: "Trajet", desc: "Suivez votre itinéraire et votre progression." },
          { to: "/consommation", label: "Consommation Énergétique", desc: "Analysez l'énergie que vous générez." },
          { to: "/data", label: "Tableau de Bord", desc: "Consultez toutes vos métriques en temps réel." },
          { to: "/Home", label: "Accueil", desc: "Pas si utile que ça finalement..." },
        ].map(({ to, label, desc }, i) => (
          <Link key={i} to={to} className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:border-[#FFCD00] transition">
            <h2 className="text-xl font-semibold text-[#001C58]">{label}</h2>
            <p className="text-gray-600">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
