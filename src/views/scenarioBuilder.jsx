// src/views/scenarioBuilder.jsx
import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle, ChevronRight, SlidersHorizontal, Zap } from 'lucide-react';

const Section = ({ title, subtitle, children }) => (
  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs font-bold uppercase text-slate-400 tracking-wider">{title}</div>
        {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
      </div>
    </div>
    {children}
  </div>
);

export default function ScenarioBuilder() {
  const { activeScenario, store, actions } = useData();
  const registry = store.registry || { assets: {}, liabilities: {}, profiles: {} };
  const timing = activeScenario.data.assumptions?.timing || { startYear: 2026, startMonth: 1 };
  const startDateStr = `${timing.startYear}-${String(timing.startMonth).padStart(2, '0')}-01`;

  const incomeProfiles = useMemo(() => Object.values(registry.profiles || {}).filter(p => p.type === 'income'), [registry]);
  const expenseProfiles = useMemo(() => Object.values(registry.profiles || {}).filter(p => p.type === 'expenses' || p.type === 'expense'), [registry]);

  const linkedAssets = activeScenario.links?.assets || [];
  const linkedLiabilities = activeScenario.links?.liabilities || [];
  const seqIncome = (activeScenario.links?.profiles?.income?.length ? activeScenario.links.profiles.income : activeScenario.data?.income?.profileSequence) || [];
  const seqExpenses = (activeScenario.links?.profiles?.expenses?.length ? activeScenario.links.profiles.expenses : activeScenario.data?.expenses?.profileSequence) || [];

  const profileRow = (p, type) => {
    const seq = type === 'income' ? seqIncome : seqExpenses;
    const existing = seq.find(x => x.profileId === p.id);
    const isActive = existing ? existing.isActive : false;
    const startDate = existing ? existing.startDate : startDateStr;
    return (
      <div key={p.id} className="flex items-center gap-3 border border-slate-200 rounded px-3 py-2 bg-slate-50">
        <input
          type="checkbox"
          checked={isActive}
          onChange={() => actions.toggleProfileInScenario(type, p.id, !isActive, startDate)}
        />
        <div className="flex-1">
          <div className="font-bold text-slate-700">{p.name}</div>
          <div className="text-xs text-slate-500 truncate">{p.description || 'No description'}</div>
        </div>
        <input
          type="date"
          className="text-xs border border-slate-200 rounded px-2 py-1"
          value={startDate}
          onChange={(e) => actions.toggleProfileInScenario(type, p.id, true, e.target.value)}
        />
      </div>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 text-blue-600 p-2 rounded-full"><SlidersHorizontal size={20} /></div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Scenario Builder</h2>
          <p className="text-sm text-slate-500">Configure scope, balance sheet, profiles, and review readiness before running.</p>
        </div>
      </div>

      {store.meta?.dataReview && store.meta.dataReview.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-sm uppercase"><AlertCircle size={16}/> Data Review</div>
          <ul className="mt-2 space-y-1 text-sm text-amber-800 list-disc list-inside">
            {store.meta.dataReview.map((item, idx) => (<li key={idx}>{item}</li>))}
          </ul>
          <div className="text-[11px] text-amber-600 mt-2">Defaults added during migration—please verify.</div>
        </div>
      )}

      <Section title="Step 1: Scenario Setup" subtitle="Name, description, and start date.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-500">Name</label>
            <input
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              value={activeScenario.name}
              onChange={(e) => actions.updateScenarioMeta('name', e.target.value)}
            />
            <label className="text-xs font-bold text-slate-500 mt-3 block">Description</label>
            <textarea
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
              value={activeScenario.description || ''}
              onChange={(e) => actions.updateScenarioMeta('description', e.target.value)}
            />
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <div className="text-xs font-bold uppercase text-slate-500 mb-2">Start Date</div>
            <div className="flex gap-2 items-center">
              <select
                className="border border-slate-300 rounded px-2 py-1 text-sm"
                value={timing.startMonth}
                onChange={(e) => actions.updateScenarioDate(timing.startYear, e.target.value)}
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(2000, m-1, 1).toLocaleString('default', { month: 'short' })}</option>
                ))}
              </select>
              <input
                type="number"
                className="w-20 border border-slate-300 rounded px-2 py-1 text-sm"
                value={timing.startYear}
                onChange={(e) => actions.updateScenarioDate(e.target.value, timing.startMonth)}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Step 2: Balance Sheet" subtitle="Select registry assets and liabilities to include; overrides are applied in detail views.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-bold uppercase text-slate-500 mb-2">Assets</div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {Object.values(registry.assets || {}).map(a => {
                const linked = linkedAssets.includes(a.id);
                return (
                  <label key={a.id} className="flex items-center gap-2 text-sm border border-slate-200 rounded px-3 py-2 bg-slate-50">
                    <input type="checkbox" checked={linked} onChange={() => linked ? actions.unlinkAssetFromScenario(a.id) : actions.linkAssetToScenario(a.id)} />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-[10px] uppercase text-slate-400">{a.type}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-slate-500 mb-2">Liabilities</div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {Object.values(registry.liabilities || {}).map(l => {
                const linked = linkedLiabilities.includes(l.id);
                return (
                  <label key={l.id} className="flex items-center gap-2 text-sm border border-slate-200 rounded px-3 py-2 bg-slate-50">
                    <input type="checkbox" checked={linked} onChange={() => linked ? actions.unlinkLiabilityFromScenario(l.id) : actions.linkLiabilityToScenario(l.id)} />
                    <span className="flex-1 truncate">{l.name}</span>
                    <span className="text-[10px] uppercase text-slate-400">{l.type}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Step 3: Profiles & Timing" subtitle="Attach income and expense profiles with start dates.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase text-slate-500">Income Profiles</div>
            {incomeProfiles.length === 0 && <div className="text-xs text-slate-400 italic">No income profiles in registry.</div>}
            {incomeProfiles.map(p => profileRow(p, 'income'))}
          </div>
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase text-slate-500">Expense Profiles</div>
            {expenseProfiles.length === 0 && <div className="text-xs text-slate-400 italic">No expense profiles in registry.</div>}
            {expenseProfiles.map(p => profileRow(p, 'expenses'))}
          </div>
        </div>
      </Section>

      <Section title="Step 4: Readiness Check" subtitle="Quick validation before running projections.">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle size={16}/> <span>{linkedAssets.length} assets linked</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle size={16}/> <span>{linkedLiabilities.length} liabilities linked</span>
          </div>
          {seqIncome.length === 0 ? (
            <div className="flex items-center gap-2 text-amber-600"><AlertCircle size={16}/> <span>No income profile active at start.</span></div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-600"><CheckCircle size={16}/> <span>{seqIncome.length} income profile(s) set</span></div>
          )}
          {seqExpenses.length === 0 ? (
            <div className="flex items-center gap-2 text-amber-600"><AlertCircle size={16}/> <span>No expense profile active at start.</span></div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-600"><CheckCircle size={16}/> <span>{seqExpenses.length} expense profile(s) set</span></div>
          )}
          <div className="flex items-center gap-2 text-slate-500"><ChevronRight size={14}/> <span>Overrides (sell dates, payoff rules) are configured in Assets/Liabilities views.</span></div>
          <div className="flex items-center gap-2 text-slate-500"><Zap size={14}/> <span>Changes auto-save; toggle back to Dashboard to view results.</span></div>
        </div>
      </Section>
    </div>
  );
}
