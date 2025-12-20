import React, { useState, useRef, useEffect } from 'react';
import { DataProvider, useData } from './context/DataContext';
import Sidebar from './components/sidebar';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { addMonths, format } from 'date-fns';

// Views
import Assumptions from './views/assumptions';
import Loans from './views/loans';
import CashFlow from './views/cashflow';
import Assets from './views/assets';
import Ledger from './views/ledger';
import ScenarioBuilder from './views/scenarioBuilder';
import ScenarioCompare from './views/comparison';
import Help from './views/help';

const Dashboard = () => {
    // Lazy load the Dashboard to avoid circular dependency issues during init
    const DashboardComponent = React.lazy(() => import('./views/dashboard'));
    return (
        <React.Suspense fallback={<div className="p-10 text-slate-400">Loading Dashboard...</div>}>
            <DashboardComponent />
        </React.Suspense>
    );
};

const TopBar = () => {
  const { activeScenario, simulationDate, actions } = useData();
  const assumptions = activeScenario.data.assumptions || activeScenario.data.globals || {};
  const timing = assumptions.timing || { startYear: 2026, startMonth: 1 };
  const horizonYears = assumptions.horizonYears || assumptions.horizon || 35;
  const startDate = new Date(timing.startYear || 2026, (timing.startMonth || 1) - 1, 1);
  const endDate = addMonths(startDate, Math.max(1, horizonYears) * 12 - 1);
  const startLabel = format(startDate, 'MMM yyyy');
  const endLabel = format(endDate, 'MMM yyyy');
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const yearClickRef = useRef(null);
  const clearTimer = () => { if (intervalRef.current) clearInterval(intervalRef.current); intervalRef.current = null; startTimeRef.current = null; };
  const clearYearTimer = () => { if (yearClickRef.current) clearTimeout(yearClickRef.current); yearClickRef.current = null; };

  const handleHold = (direction) => {
    const modifier = direction === 'next' ? 1 : -1;
    actions.setSimulationMonth(d => addMonths(d, modifier));
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        let step = 1;
        if (elapsed > 2000) step = 3;
        if (elapsed > 5000) step = 12;
        actions.setSimulationMonth(d => addMonths(d, step * modifier));
    }, 200);
  };

  const handleYearClick = (direction) => {
    clearYearTimer();
    yearClickRef.current = setTimeout(() => {
        actions.setSimulationMonth(d => addMonths(d, 12 * direction));
        clearYearTimer();
    }, 180);
  };

  const handleYearDoubleClick = (direction) => {
    clearYearTimer();
    actions.setSimulationMonth(d => addMonths(d, 60 * direction));
  };

  useEffect(() => {
    return () => {
        clearTimer();
        clearYearTimer();
    };
  }, []);

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm z-20 h-16">
       <div className="flex items-center gap-6">
           <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Scenario</div>
                <div className="font-bold text-slate-800 text-sm">{activeScenario.name}</div>
           </div>
           <div className="h-8 w-px bg-slate-200"></div>
           <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</div>
                <div className="flex items-center gap-1">
                    <select
                      className="bg-transparent text-sm font-bold text-slate-700 py-0 outline-none cursor-pointer hover:text-blue-600"
                      value={timing.startMonth}
                      onChange={(e) => actions.updateScenarioDate(timing.startYear, e.target.value)}
                    >
                      {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{new Date(2000, m-1, 1).toLocaleString('default', { month: 'short' })}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="w-12 bg-transparent text-sm font-bold text-slate-700 py-0 outline-none hover:text-blue-600 text-center"
                      value={timing.startYear}
                      onChange={(e) => actions.updateScenarioDate(e.target.value, timing.startMonth)}
                    />
                </div>
           </div>
       </div>
       <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            className="p-2 hover:bg-white hover:text-blue-600 rounded shadow-sm text-slate-500 transition-all active:scale-95"
            title="Jump back one year (double-click for five years)"
            onClick={() => handleYearClick(-1)}
            onDoubleClick={() => handleYearDoubleClick(-1)}
          >
            <ChevronsLeft size={20} />
          </button>
          <button
            className="p-2 hover:bg-white hover:text-blue-600 rounded shadow-sm text-slate-500 transition-all active:scale-95"
            title="Step back one month (hold to accelerate)"
            onMouseDown={() => handleHold('prev')}
            onMouseUp={clearTimer}
            onMouseLeave={clearTimer}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col items-center w-32 select-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Model</span>
            <span className="text-base font-bold text-blue-700">{format(simulationDate, 'MMM yyyy')}</span>
          </div>
          <button
            className="p-2 hover:bg-white hover:text-blue-600 rounded shadow-sm text-slate-500 transition-all active:scale-95"
            title="Step forward one month (hold to accelerate)"
            onMouseDown={() => handleHold('next')}
            onMouseUp={clearTimer}
            onMouseLeave={clearTimer}
          >
            <ChevronRight size={20} />
          </button>
          <button
            className="p-2 hover:bg-white hover:text-blue-600 rounded shadow-sm text-slate-500 transition-all active:scale-95"
            title="Jump forward one year (double-click for five years)"
            onClick={() => handleYearClick(1)}
            onDoubleClick={() => handleYearDoubleClick(1)}
          >
            <ChevronsRight size={20} />
          </button>
          <div className="h-6 w-px bg-slate-200 mx-1"></div>
          <button
            className="px-3 py-1 text-xs font-bold rounded-md bg-white text-slate-700 border border-slate-200 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"
            title={`Jump to scenario start (${startLabel})`}
            onClick={() => actions.setSimulationMonth(startDate)}
          >
            Start · {startLabel}
          </button>
          <button
            className="px-3 py-1 text-xs font-bold rounded-md bg-white text-slate-700 border border-slate-200 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"
            title={`Jump to end of horizon (${endLabel})`}
            onClick={() => actions.setSimulationMonth(endDate)}
          >
            Horizon · {endLabel}
          </button>
       </div>
    </div>
  );
};

const AppShell = () => {
  const [currentView, setCurrentView] = useState('assets');
  const { isLoaded } = useData();

  if (!isLoaded) return <div className="flex h-screen items-center justify-center text-slate-400 animate-pulse">Loading Financial Core v3.3.0...</div>;

  const renderView = () => {
    switch(currentView) {
      case 'dashboard': return <Dashboard />;
      case 'cashflow': return <CashFlow />;
      case 'loans': return <Loans />;
      case 'assets': return <Assets />;
      case 'assumptions': return <Assumptions />;
      case 'ledger': return <Ledger />;
      case 'builder': return <ScenarioBuilder />;
      case 'compare': return <ScenarioCompare />;
      case 'help': return <Help />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar currentView={currentView} setView={setCurrentView} />
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <TopBar />
        <div className="flex-1 overflow-auto relative">
           {renderView()}
        </div>
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
