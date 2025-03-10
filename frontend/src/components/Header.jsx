import React from 'react';
import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="bg-white shadow-md border-b border-gray-200">
      <nav className="container mx-auto flex justify-between items-center py-4 px-6">
        <Link to="/" className="text-[#001C58] text-2xl font-bold uppercase tracking-tight">
          🚴 Dashboard Cyclisme
        </Link>
        <ul className="flex space-x-6 text-[#001C58] text-lg">
          {[
            { to: "/", label: "Accueil" },
            { to: "/trajet", label: "Trajet" },
            { to: "/consommation", label: "Votre impact" },
            { to: "/data", label: "Tableau de bord" },
          ].map(({ to, label }, i) => (
            <li key={i}>
              <Link to={to} className="hover:text-[#FFCD00] transition">{label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
