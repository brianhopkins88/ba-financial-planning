import React, { useState } from 'react';
import { DataProvider, useData } from './context/DataContext';
import { LayoutDashboard, Home, Banknote, PieChart } from 'lucide-react';

// Placeholder Dashboard for Phase 1
const Dashboard = () => {
  const { data } = useData();
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Current Configuration</h2>
      <div className="bg-white p-4 rounded shadow border border-gray-200">
        <div className="mb-4 text-sm text-gray-500">
          Raw Data Loaded from <code className="bg-gray-100 px-1 rounded">src/data/hgv_data.json</code>
        </div>
        <pre className="text-xs overflow-auto h-[500px] bg-slate-50 p-4 rounded border border-slate-200 text-slate-700">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
};

const Sidebar = ({ activeTab, setActiveTab }) => {
  const menu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'loans', label: 'Loans & Debt', icon: Home },
    { id: 'cashflow', label: 'Cash Flow', icon: Banknote },
    { id: 'assets', label: 'Assets & Strategy', icon: PieChart },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col shadow-xl">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-blue-400 tracking-tight">BA Financial</h1>
        <div className="text-xs text-slate-500 mt-1">Planning Modeler v7.0</div>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {menu.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === item.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

const MainContent = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { isLoaded } = useData();

  if (!isLoaded) return (
    <div className="flex items-center justify-center h-screen w-full bg-slate-50">
      <div className="text-slate-400 animate-pulse">Loading Financial Data...</div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 overflow-auto">
        <header className="bg-white h-16 border-b border-gray-200 flex items-center px-8 justify-between sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-gray-700 capitalize">{activeTab}</h2>
          <div className="text-xs text-gray-400">Phase 1: Data Layer Active</div>
        </header>

        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab !== 'dashboard' && (
          <div className="flex flex-col items-center justify-center h-[80vh] text-slate-400">
            <div className="text-4xl mb-4 opacity-20">🚧</div>
            <p>Module "{activeTab}" is coming in Phase 2/3</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <DataProvider>
      <MainContent />
    </DataProvider>
  );
}