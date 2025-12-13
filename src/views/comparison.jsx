import React, { useMemo, useState, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { runFinancialSimulation } from '../utils/financial_engine.js';
import { cloneDeep } from 'lodash';
import { ChevronDown, Plus, X } from 'lucide-react';

const ages = [65, 70, 75, 80, 85, 90];

const resolveScenario = (scenario, registry) => {
    const resolved = cloneDeep(scenario);
    const links = resolved.links || { assets: [], liabilities: [], profiles: {} };
    const data = resolved.data ? cloneDeep(resolved.data) : {};

    // Assets: keep existing; add linked-from-registry when missing
    const existingAssets = data.assets?.accounts || {};
    const mergedAssets = { ...existingAssets };
    (links.assets || []).forEach(id => {
        if (!mergedAssets[id] && registry?.assets?.[id]) mergedAssets[id] = cloneDeep(registry.assets[id]);
    });
    data.assets = { accounts: mergedAssets };

    // Loans: keep existing; add linked-from-registry when missing
    const existingLoans = data.loans || {};
    const mergedLoans = { ...existingLoans };
    (links.liabilities || []).forEach(id => {
        if (!mergedLoans[id] && registry?.liabilities?.[id]) mergedLoans[id] = cloneDeep(registry.liabilities[id]);
    });
    data.loans = mergedLoans;

    // Profiles (income/expense) sequences
    data.income = data.income || {};
    data.expenses = data.expenses || {};
    data.income.profileSequence = links.profiles?.income || data.income.profileSequence || [];
    data.expenses.profileSequence = links.profiles?.expenses || data.expenses.profileSequence || [];

    resolved.data = data;
    return resolved;
};

const getProfileSummary = (scenario, store) => {
    const seqIncome = scenario.links?.profiles?.income || scenario.data?.income?.profileSequence || [];
    const seqExpense = scenario.links?.profiles?.expenses || scenario.data?.expenses?.profileSequence || [];
    const findFirst = (seq) => {
        if (!seq || seq.length === 0) return null;
        const active = seq.filter(i => i.isActive !== false);
        const sorted = active.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
        return sorted[0];
    };
    const i = findFirst(seqIncome);
    const e = findFirst(seqExpense);
    const iName = i ? (store.profiles?.[i.profileId]?.name || i.profileId) : 'Not set';
    const eName = e ? (store.profiles?.[e.profileId]?.name || e.profileId) : 'Not set';
    return { income: { name: iName, start: i?.startDate }, expense: { name: eName, start: e?.startDate } };
};

const pickSnapshotByAge = (simulation, scenario, ageTarget) => {
    if (!simulation) return null;
    const startMonth = scenario.data?.assumptions?.timing?.startMonth || 1;
    const birthYear = scenario.data?.income?.primary?.birthYear || 1968;
    const targetYear = birthYear + ageTarget;
    const target = simulation.timeline.find(t => t.year === targetYear && t.month === startMonth) ||
                   simulation.timeline.find(t => t.year === targetYear);
    if (!target) return null;
    const b = target.balances || {};
    return {
        year: target.year,
        netWorth: target.netWorth,
        cash: b.cash || 0,
        joint: b.joint || 0,
        inherited: b.inherited || 0,
        retirement: b.retirement || 0,
        property: b.property || 0,
        reverseMortgage: b.reverseMortgage || 0,
        totalDebt: b.totalDebt || 0
    };
};

const eventsUpToAge = (simulation, scenario, ageTarget) => {
    if (!simulation) return [];
    const birthYear = scenario.data?.income?.primary?.birthYear || 1968;
    const cutoffYear = birthYear + ageTarget;
    return (simulation.events || [])
        .filter(e => {
            const yr = parseInt((e.date || '').slice(0, 4), 10);
            return !Number.isNaN(yr) && yr <= cutoffYear;
        })
        .slice(-6); // keep recent events up to the cutoff
};

const ScenarioSelector = ({ value, options, onChange, disableIds, label }) => {
    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">{label}</span>
            <div className="relative flex-1">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-semibold text-slate-700 bg-white"
                >
                    {options.map(opt => (
                        <option key={opt.id} value={opt.id} disabled={disableIds.includes(opt.id)}>
                            {opt.name}{disableIds.includes(opt.id) ? ' (in use)' : ''}
                        </option>
                    ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
            </div>
        </div>
    );
};

const ValueBlock = ({ label, value, tone = 'plain' }) => {
    const toneClass = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-slate-700';
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{label}</span>
            <span className={`font-semibold font-mono ${toneClass}`}>{value}</span>
        </div>
    );
};

export default function ScenarioCompare() {
    const { store, activeScenario } = useData();
    const scenarioOptions = useMemo(() => Object.values(store.scenarios || {}), [store.scenarios]);

    const initialIds = useMemo(() => {
        const ids = scenarioOptions.map(s => s.id);
        const primary = activeScenario?.id || ids[0];
        const secondary = ids.find(id => id !== primary);
        return secondary ? [primary, secondary] : [primary];
    }, [scenarioOptions, activeScenario]);

    const [selected, setSelected] = useState(initialIds);

    const handleSelect = useCallback((idx, id) => {
        if (selected.includes(id) && selected[idx] !== id) {
            alert("That scenario is already in another column. Choose a different one.");
            return;
        }
        const next = [...selected];
        next[idx] = id;
        setSelected(next);
    }, [selected]);

    const addColumn = () => {
        if (selected.length >= 3) return;
        const unused = scenarioOptions.find(s => !selected.includes(s.id));
        if (unused) setSelected([...selected, unused.id]);
    };

    const removeThird = () => {
        if (selected.length === 3) setSelected(selected.slice(0, 2));
    };

    const scenarioData = useMemo(() => {
        return selected.map(id => {
            const scen = store.scenarios[id];
            if (!scen) return { id, data: null };
            const resolved = resolveScenario(scen, store.registry);
            const sim = runFinancialSimulation(resolved, store.profiles, store.registry);
            return { id, data: { scenario: resolved, simulation: sim } };
        });
    }, [selected, store]);

    const renderAssetsCell = (simData, scen, age) => {
        const snap = pickSnapshotByAge(simData?.simulation, scen, age);
        if (!snap) return <div className="text-xs text-slate-400">No data</div>;
        const netWorth = Math.round(snap.netWorth || 0).toLocaleString();
        return (
            <div className="space-y-1">
                <ValueBlock label="Net Worth" value={`$${netWorth}`} tone="good" />
                <ValueBlock label="Cash" value={`$${Math.round(snap.cash).toLocaleString()}`} />
                <ValueBlock label="Joint" value={`$${Math.round(snap.joint).toLocaleString()}`} />
                <ValueBlock label="Inherited" value={`$${Math.round(snap.inherited).toLocaleString()}`} />
                <ValueBlock label="Retirement" value={`$${Math.round(snap.retirement).toLocaleString()}`} />
                <ValueBlock label="Property" value={`$${Math.round(snap.property).toLocaleString()}`} />
                <ValueBlock label="Reverse Mortgage" value={`$${Math.round(snap.reverseMortgage).toLocaleString()}`} tone={snap.reverseMortgage > 0 ? 'bad' : 'plain'} />
                <ValueBlock label="Other Debt" value={`$${Math.round(snap.totalDebt).toLocaleString()}`} tone={snap.totalDebt > 0 ? 'bad' : 'plain'} />
            </div>
        );
    };

    const renderEventsCell = (simData, scen, age) => {
        const items = eventsUpToAge(simData?.simulation, scen, age);
        if (!items.length) return <div className="text-xs text-slate-400">No events yet</div>;
        return (
            <ul className="text-xs text-slate-700 list-disc pl-4 space-y-1">
                {items.map((ev, idx) => (
                    <li key={`${ev.date}-${idx}`}>
                        <span className="font-mono text-slate-500 mr-1">{ev.date}</span>
                        {ev.text}
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Scenario Comparison</h1>
                    <p className="text-sm text-slate-500">Select up to three scenarios and compare profiles, net worth milestones, and major events side-by-side.</p>
                </div>
                <div className="flex items-center gap-2">
                    {selected.length < 3 && (
                        <button onClick={addColumn} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded shadow hover:bg-blue-700">
                            <Plus size={14}/> Add Scenario
                        </button>
                    )}
                    {selected.length === 3 && (
                        <button onClick={removeThird} className="flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-600 text-sm rounded shadow hover:bg-slate-200">
                            <X size={14}/> Remove 3rd
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th rowSpan={3} className="px-3 py-3 text-left text-xs font-bold text-slate-600 uppercase">Age</th>
                            {scenarioData.map((entry, idx) => (
                                <th key={`${entry.id}-selector`} colSpan={2} className="px-3 py-3">
                                    <ScenarioSelector
                                        label={`Scenario ${idx + 1}`}
                                        value={entry.id}
                                        options={scenarioOptions}
                                        disableIds={selected.filter((_, i) => i !== idx)}
                                        onChange={(id) => handleSelect(idx, id)}
                                    />
                                </th>
                            ))}
                        </tr>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            {scenarioData.map((entry) => {
                                const summary = entry.data ? getProfileSummary(entry.data.scenario, store) : null;
                                return (
                                    <th key={`${entry.id}-profiles`} colSpan={2} className="px-3 py-2 text-left">
                                        {summary ? (
                                            <div className="text-xs text-slate-600 space-y-1">
                                                <div><span className="font-bold text-slate-700">Income:</span> {summary.income.name} <span className="text-slate-400">({summary.income.start || 'n/a'})</span></div>
                                                <div><span className="font-bold text-slate-700">Expenses:</span> {summary.expense.name} <span className="text-slate-400">({summary.expense.start || 'n/a'})</span></div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400">No data</div>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                        <tr className="bg-slate-100 border-b border-slate-200 text-[11px] uppercase text-slate-500">
                            {scenarioData.map((entry) => (
                                <React.Fragment key={`${entry.id}-labels`}>
                                    <th className="px-3 py-2 text-left font-bold">Assets & Debt</th>
                                    <th className="px-3 py-2 text-left font-bold">Events</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ages.map(age => (
                            <tr key={age} className="border-b border-slate-100 align-top">
                                <td className="px-3 py-4 text-sm font-bold text-slate-700 bg-slate-50">{age}</td>
                                {scenarioData.map(entry => (
                                    <React.Fragment key={`${entry.id}-${age}`}>
                                        <td className="px-3 py-3">
                                            {entry.data ? renderAssetsCell(entry.data.simulation, entry.data.scenario, age) : <span className="text-xs text-slate-400">No data</span>}
                                        </td>
                                        <td className="px-3 py-3">
                                            {entry.data ? renderEventsCell(entry.data.simulation, entry.data.scenario, age) : <span className="text-xs text-slate-400">No data</span>}
                                        </td>
                                    </React.Fragment>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
