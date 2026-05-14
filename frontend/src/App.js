import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import FeaturePage from './components/FeaturePage';
import AIAnalysis from './components/AIAnalysis';
import Analytics from './components/Analytics';
import Webhooks from './components/Webhooks';
import { featureConfigs } from './config/features';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogin = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <ToastContainer position="top-right" theme="dark" />
      </>
    );
  }

  return (
    <Router>
      <div className="app">
        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} user={user} onLogout={handleLogout} />
        <main className={`main-content ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
          <Routes>
            <Route path="/" element={<Dashboard token={token} />} />
            {featureConfigs.map(config => (
              <Route
                key={config.path}
                path={config.path}
                element={<FeaturePage config={config} token={token} />}
              />
            ))}
            <Route path="/ai-analysis" element={<AIAnalysis token={token} user={user} />} />
            <Route path="/analytics" element={<Analytics token={token} />} />
            <Route path="/webhooks" element={<Webhooks token={token} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <ToastContainer position="top-right" theme="dark" />
      </div>
    </Router>
  );
}

export default App;
