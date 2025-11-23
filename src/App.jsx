import React, { useState } from 'react';
import { DataProvider, useData } from './context/DataContext';
import Sidebar from './components/Sidebar';

// Views
import Assumptions from './views/assumptions';
import Loans from './views/loans';

// Placeholders (until we build them)
const Dashboard = () => <div className="p-10 text-slate-400">Dashboard Module Coming Soon (Phase 4)</div>;
const Expenses = () => <div className="p-10 text-slate-400">Expenses Module Coming Soon (Phase 3)</div>;

// Inner App Component to consume Context
const AppShell = () => {
  const [currentView, setCurrentView] = useState('loans'); // Defaulting to loans for current work
  const { isLoaded } = useData();

  if (!isLoaded) return <div className="flex h-screen items-center justify-center text-slate-400">Loading Financial Core...</div>;

  const renderView = () => {
    switch(currentView) {
      case 'dashboard': return <Dashboard />;
      case 'expenses': return <Expenses />;
      case 'loans': return <Loans />;
      case 'assumptions': return <Assumptions />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <Sidebar currentView={currentView} setView={setCurrentView} />
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {renderView()}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}