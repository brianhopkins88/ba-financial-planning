import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Plus, Trash2, Save, Receipt, ChevronDown, ChevronRight, Calendar, CheckSquare, Square, CreditCard, Pencil, Copy } from 'lucide-react';
import { parseISO, isBefore, isAfter, startOfToday, format } from 'date-fns';

const BillRow = ({ item, onChange, onDelete }) => (
  <div className="flex items-center gap-2 group mb-2 pl-2 border-l-2 border-transparent hover:border-blue-400 transition-colors">
    <input
      className="flex-1 min-w-0 border-b border-slate-100 focus:border-blue-500 px-2 py-1 text-sm text-slate-700 bg-transparent outline-none transition-colors"
      value={item.name}
      onChange={(e) => onChange('name', e.target.value)}
      placeholder="Expense Name"
    />
    <div className="relative w-28 flex-shrink-0">
        <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
        <input
          type="number"
          className="w-full pl-5 border-b border-slate-100 focus:border-blue-500 px-2 py-1 text-sm text-slate-700 text-right font-mono bg-transparent outline-none transition-colors"
          value={item.amount === 0 ? '' : item.amount}
          placeholder="0"
          onChange={(e) => {
            const val = e.target.value;
            onChange('amount', val === '' ? 0 : parseFloat(val));
          }}
        />
    </div>
    <button onClick={onDelete} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
      <Trash2 size={16} />
    </button>
  </div>
);

const Accordion = ({ title, total, children, defaultOpen = false, onAdd }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4">
      <div
        className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 font-bold text-slate-700">
          {isOpen ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
          {title}
        </div>
        <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">${total.toLocaleString()}</span>
      </div>
      {isOpen && (
        <div className="p-4 bg-white border-t border-slate-100">
           {children}
           <button
             onClick={(e) => { e.stopPropagation(); onAdd(); }}
             className="w-full py-2 border-2 border-dashed border-slate-100 rounded text-slate-400 text-xs hover:border-blue-300 hover:text-blue-500 transition-colors mt-3 flex items-center justify-center gap-1"
           >
             <Plus size={14}/> Add Item
           </button>
        </div>
      )}
    </div>
  );
};

export default function Expenses() {
  const { store, activeScenario, actions, simulationDate } = useData();
  const [showProfileMgr, setShowProfileMgr] = useState(false);

  // We edit the "Scenario Data" directly (Scratchpad concept)
  const editData = activeScenario.data.expenses;
  const profileSequence = editData.profileSequence || [];
  const globalStart = activeScenario.data.globals.timing;
  const globalStartDateStr = `${globalStart.startYear}-${String(globalStart.startMonth).padStart(2, '0')}-01`;

  // --- DERIVE EFFECTIVE PROFILE ---
  const getActiveProfile = () => {
      const activeItems = profileSequence.filter(item =>
          item.isActive && !isAfter(parseISO(item.startDate), simulationDate)
      );
      if (activeItems.length === 0) return null;
      const effectiveItem = activeItems[activeItems.length - 1];
      const profile = store.profiles[effectiveItem.profileId];
      return profile ? { ...profile, ...effectiveItem } : null;
  };
  const activeProfile = getActiveProfile();
  const activeProfileName = activeProfile ? activeProfile.name : "Custom / None";

  // --- CALCULATIONS ---
  const calculateTotal = (arr) => arr.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalBills = calculateTotal(editData.bills);
  const totalHome = calculateTotal(editData.home);
  const totalLiving = calculateTotal(editData.living);

  const activeDebtItems = Object.values(activeScenario.data.loans).map(loan => {
    if (loan.active === false) return null;
    if (!loan.inputs.startDate) return null;
    const loanStart = parseISO(loan.inputs.startDate);
    if (!isBefore(loanStart, simulationDate) && loanStart.getTime() !== simulationDate.getTime()) return null;

    const stratId = loan.activeStrategyId || 'base';
    const strat = loan.strategies[stratId];
    const minPayment = loan.inputs.payment || 0;
    const currentMonthKey = format(simulationDate, 'yyyy-MM');
    const extraPayment = strat.extraPayments?.[currentMonthKey] || 0;

    return {
      id: loan.id, name: loan.name, minPayment, extraPayment, total: minPayment + extraPayment
    };
  }).filter(Boolean);

  const totalDebt = activeDebtItems.reduce((sum, item) => sum + item.total, 0);
  const monthlyBurn = totalBills + totalHome + totalLiving + totalDebt;

  // --- ACTIONS ---
  const updateBill = (category, index, field, value) => {
    const list = [...editData[category]];
    list[index] = { ...list[index], [field]: value };
    actions.updateScenarioData(`expenses.${category}`, list);
  };
  const addBill = (category) => {
    const list = [...editData[category]];
    list.push({ id: Date.now(), name: "New Item", amount: 0 });
    actions.updateScenarioData(`expenses.${category}`, list);
  };
  const removeBill = (category, index) => {
    const list = [...editData[category]];
    list.splice(index, 1);
    actions.updateScenarioData(`expenses.${category}`, list);
  };

  const handleSaveAsNew = () => {
    const name = prompt(`Name this New Expense profile:`);
    if(name) actions.saveProfile('expenses', name, editData);
  };

  const handleSaveChanges = () => {
      if (activeProfile && confirm(`Overwrite profile "${activeProfile.name}" with current changes?`)) {
          actions.updateProfile(activeProfile.profileId, editData);
      }
  };

  const handleDeleteProfile = (pId, name) => {
     if(confirm(`Delete profile "${name}"?`)) {
         actions.deleteProfile(pId);
     }
  };

  const handleRenameProfile = (pId, currentName) => {
    const newName = prompt("Enter new profile name:", currentName);
    if (newName && newName !== currentName) {
      actions.renameProfile(pId, newName);
    }
  };

  const handleToggle = (pId, active, date) => {
      if (active) {
          const conflict = profileSequence.find(p => p.isActive && p.startDate === date && p.profileId !== pId);
          if (conflict) {
              if(!confirm(`Warning: Another profile is already active on ${date}. \n\nReplace it?`)) return;
              actions.toggleProfileInScenario('expenses', conflict.profileId, false, conflict.startDate);
          }
      }
      if (!active) {
          const proposedActive = profileSequence.filter(p =>
              p.profileId !== pId &&
              p.isActive &&
              !isAfter(parseISO(p.startDate), simulationDate)
          );

          const itemBeingDisabled = profileSequence.find(p => p.profileId === pId);
          const isRelevantToCurrentDate = !isAfter(parseISO(itemBeingDisabled?.startDate || date), simulationDate);

          if (isRelevantToCurrentDate) {
              if (proposedActive.length === 0) {
                  alert("Cannot disable: At least one profile must be active and cover the current simulation date.");
                  return;
              }
          }
      }
      actions.toggleProfileInScenario('expenses', pId, active, date);
  };

  const availableProfiles = Object.values(store.profiles || {}).filter(p => p.type === 'expenses');

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm z-10">
        <div className="flex justify-between items-start mb-6">

          {/* HEADER TITLE & ACTIVE BADGE */}
          <div>
            <div className="flex items-center gap-3">
                 <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Receipt /> Expense Manager</h2>
                 <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Active:</span>
                    <span className="text-xs font-bold text-blue-700">{activeProfileName}</span>
                 </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
                 <span className="text-sm text-slate-500">Total Monthly Burn:</span>
                 <span className="text-xl font-bold text-red-500">${Math.round(monthlyBurn).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
             <button
                onClick={() => setShowProfileMgr(!showProfileMgr)}
                className={`text-xs font-bold px-3 py-2 rounded border transition-colors flex items-center gap-2 ${showProfileMgr ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}
             >
                <Calendar size={14} /> Profile Manager {showProfileMgr ? '▲' : '▼'}
             </button>

             <div className="flex items-center gap-2">
                 {activeProfile && (
                    <button onClick={handleSaveChanges} className="text-xs font-bold px-3 py-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-2 shadow-sm transition-colors" title="Save changes to current profile">
                        <Save size={14} /> Save to "{activeProfile.name}"
                    </button>
                 )}
                 <button onClick={handleSaveAsNew} className="text-xs font-bold px-3 py-2 rounded bg-slate-800 text-white hover:bg-slate-700 flex items-center gap-2 shadow-sm transition-colors" title="Save as new Profile">
                    <Copy size={14} /> Save as New
                 </button>
             </div>
          </div>
        </div>

        {showProfileMgr && (
            <div className="mb-6 bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Active Profile Sequence</h3>
                <div className="space-y-2">
                    {availableProfiles.length === 0 && <div className="text-sm text-slate-400 italic">No saved profiles found.</div>}
                    {availableProfiles.map(p => {
                        const seqEntry = profileSequence.find(s => s.profileId === p.id);
                        const isActive = seqEntry?.isActive;
                        const startDate = seqEntry?.startDate || globalStartDateStr;

                        return (
                            <div key={p.id} className="flex items-center gap-4 bg-white p-2 rounded border border-slate-100 shadow-sm group">
                                <button
                                    onClick={() => handleToggle(p.id, !isActive, startDate)}
                                    className={`p-1 rounded ${isActive ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                                >
                                    {isActive ? <CheckSquare size={20} /> : <Square size={20} />}
                                </button>
                                <div className="flex-1 flex items-center gap-2">
                                    <div className="text-sm font-bold text-slate-700">{p.name}</div>
                                    <button
                                        onClick={() => handleRenameProfile(p.id, p.name)}
                                        className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                        title="Rename Profile"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 uppercase">Starts:</span>
                                    <input type="date" className="text-sm border rounded px-2 py-1"
                                        value={startDate} disabled={!isActive}
                                        onChange={(e) => handleToggle(p.id, true, e.target.value)}
                                    />
                                </div>
                                {!isActive && (
                                    <button
                                        onClick={() => handleDeleteProfile(p.id, p.name)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        title="Delete Profile"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-8 max-w-4xl mx-auto w-full">
          <Accordion title="Recurring Bills" total={totalBills} defaultOpen={true} onAdd={() => addBill('bills')}>
             <div className="space-y-1">
                 {editData.bills.map((item, idx) => (
                   <BillRow key={idx} item={item} onChange={(f, v) => updateBill('bills', idx, f, v)} onDelete={() => removeBill('bills', idx)} />
                 ))}
             </div>
          </Accordion>

          <Accordion title="Home Expenses" total={totalHome} defaultOpen={false} onAdd={() => addBill('home')}>
             <div className="space-y-1">
                 {editData.home.map((item, idx) => (
                   <BillRow key={idx} item={item} onChange={(f, v) => updateBill('home', idx, f, v)} onDelete={() => removeBill('home', idx)} />
                 ))}
             </div>
          </Accordion>

          <Accordion title="Living Expenses" total={totalLiving} defaultOpen={false} onAdd={() => addBill('living')}>
             <div className="space-y-1">
                 {editData.living.map((item, idx) => (
                   <BillRow key={idx} item={item} onChange={(f, v) => updateBill('living', idx, f, v)} onDelete={() => removeBill('living', idx)} />
                 ))}
             </div>
          </Accordion>

          <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 border-dashed mt-6">
               <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
                 <h3 className="font-bold text-slate-700 flex items-center gap-2"><CreditCard size={16}/> Active Debts</h3>
                 <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2 py-1 rounded shadow-sm">${totalDebt}</span>
               </div>
               <div className="space-y-3">
                 {activeDebtItems.length === 0 && <div className="text-xs text-slate-400 italic">No active loans found started before today.</div>}
                 {activeDebtItems.map((loan) => (
                   <div key={loan.id} className="bg-white p-3 rounded shadow-sm border border-slate-100 flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-700">{loan.name}</span>
                      <span className="font-mono text-sm font-bold text-slate-800">${loan.total}</span>
                   </div>
                 ))}
               </div>
            </div>
      </div>
    </div>
  );
}