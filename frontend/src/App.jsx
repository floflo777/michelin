import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GlobalStateProvider } from './pages/GlobalStateProvider';
import Header from './components/Header';
import Home from './pages/Home';
import Trajet from './pages/trajet';
import Consommation from './pages/consommation';
import Data from './pages/data';

const App = () => {
  return (
    <GlobalStateProvider>
      <Router>
        <Header />
        <div className="min-h-screen bg-gray-100">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trajet" element={<Trajet />} />
            <Route path="/consommation" element={<Consommation />} />
            <Route path="/data" element={<Data />} />
          </Routes>
        </div>
      </Router>
    </GlobalStateProvider>
  );
};

export default App;
