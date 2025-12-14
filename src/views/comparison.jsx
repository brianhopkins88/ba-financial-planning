import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { runFinancialSimulation } from '../utils/financial_engine.js';
import { ensureScenarioShape } from '../utils/scenario_shape.js';
import { cloneDeep } from 'lodash';
import { Plus, X } from 'lucide-react';

const ages = [65, 70, 75, 80, 85, 90];

const resolveScenario = (scenario, registry) => {
    const resolved = ensureScenarioShape(cloneDeep(scenario));
    const links = resolved.links || { assets: [], liabilities: [], profiles: {} };
    const data = resolved.data ? cloneDeep(resolved.data) : {};

    // Assets: merge linked items from registry and apply overrides
    const existingAssets = data.assets?.accounts || {};
    const mergedAssets = { ...existingAssets };
    (links.assets || []).forEach(id => {
        if (!mergedAssets[id] && registry?.assets?.[id]) mergedAssets[id] = cloneDeep(registry.assets[id]);
    });
    Object.entries(resolved.overrides?.assets || {}).forEach(([id, ov]) => {
        if (mergedAssets[id]) Object.assign(mergedAssets[id], cloneDeep(ov));
    });
    data.assets = { accounts: mergedAssets };

    // Loans: merge linked items from registry and apply overrides
    const existingLoans = data.loans || {};
    const mergedLoans = { ...existingLoans };
    (links.liabilities || []).forEach(id => {
        if (!mergedLoans[id] && registry?.liabilities?.[id]) mergedLoans[id] = cloneDeep(registry.liabilities[id]);
    });
    Object.entries(resolved.overrides?.liabilities || {}).forEach(([id, ov]) => {
        if (mergedLoans[id]) Object.assign(mergedLoans[id], cloneDeep(ov));
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
    const catalog = store.registry?.profiles || store.profiles || {};
    const inlineIncomeName = scenario.data?.income?.primary ? 'Scenario Income (inline)' : 'Not set';
    const inlineExpenseName = scenario.data?.expenses ? 'Scenario Expenses (inline)' : 'Not set';
    const iName = i ? (catalog[i.profileId]?.name || inlineIncomeName || i.profileId) : inlineIncomeName;
    const eName = e ? (catalog[e.profileId]?.name || inlineExpenseName || e.profileId) : inlineExpenseName;
    return { income: { name: iName, start: i?.startDate }, expense: { name: eName, start: e?.startDate } };
};

const pickSnapshotByAge = (simulation, scenario, ageTarget) => {
    if (!simulation || !simulation.timeline) return null;
    const startMonth = scenario.data?.assumptions?.timing?.startMonth || 1;
    const birthYear = scenario.data?.income?.primary?.birthYear || 1968;
    const targetYear = birthYear + ageTarget;

    // Prefer exact year/month match
    let target = simulation.timeline.find(t => t.year === targetYear && t.month === startMonth)
              || simulation.timeline.find(t => t.year === targetYear);

    // Fallback: nearest entry at or after the target age
    if (!target) {
        const byAge = simulation.timeline
            .filter(t => typeof t.age === 'number' && t.age >= ageTarget)
            .sort((a, b) => a.age - b.age);
        target = byAge[0] || simulation.timeline[simulation.timeline.length - 1];
    }

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
        .slice(-8); // keep the latest handful up to the cutoff
};

const ScenarioSelector = ({ value, options, onChange, disableIds, label }) => {
    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">{label}</span>
            <div className="flex-1">
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
        return primary ? [primary] : [];
    }, [scenarioOptions, activeScenario]);

    const [selected, setSelected] = useState(initialIds);

    // Keep selection aligned with active scenario if nothing is selected yet
    useEffect(() => {
        if (selected.length === 0 && activeScenario?.id) {
            setSelected([activeScenario.id]);
        }
    }, [activeScenario?.id, selected.length]);

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

    const removeColumn = (idx) => {
        if (idx === 0) return; // always keep the first column
        setSelected(selected.filter((_, i) => i !== idx));
    };

    const scenarioData = useMemo(() => {
        const profileCatalog = store.registry?.profiles || store.profiles || {};
        return selected.map(id => {
            const scen = id === activeScenario?.id ? activeScenario : store.scenarios[id];
            if (!scen) return { id, data: null };
            try {
                const resolved = resolveScenario(scen, store.registry);
                const sim = runFinancialSimulation(resolved, profileCatalog, store.registry);
                if (!sim || !sim.timeline || sim.timeline.length === 0) {
                    console.warn('Scenario compare: simulation returned no timeline', { scenarioId: id });
                    return { id, data: { scenario: resolved, simulation: { timeline: [], events: [] } } };
                }
                return { id, data: { scenario: resolved, simulation: sim } };
            } catch (err) {
                console.error('Scenario compare simulation error', err);
                return { id, data: { scenario: scen, simulation: { timeline: [], events: [] }, error: err } };
            }
        });
    }, [selected, store, activeScenario]);

    const renderAssetsCell = (simulation, scen, age) => {
        const snap = pickSnapshotByAge(simulation, scen, age);
        if (!snap) return <div className="text-xs text-slate-400">No data (timeline not found)</div>;
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

    const renderEventsCell = (simulation, scen, age) => {
        const items = eventsUpToAge(simulation, scen, age);
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
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
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
                </div>
            </div>

            <div className="overflow-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                <table className="min-w-full text-sm table-auto">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th rowSpan={3} className="px-3 py-3 text-left text-xs font-bold text-slate-600 uppercase w-16">Age</th>
                            {scenarioData.map((entry, idx) => (
                                <th key={`${entry.id}-selector`} colSpan={2} className="px-3 py-3 min-w-[280px]">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <ScenarioSelector
                                                label={`Scenario ${idx + 1}`}
                                                value={entry.id}
                                                options={scenarioOptions}
                                                disableIds={selected.filter((_, i) => i !== idx)}
                                                onChange={(id) => handleSelect(idx, id)}
                                            />
                                        </div>
                                        {idx > 0 && (
                                            <button
                                                onClick={() => removeColumn(idx)}
                                                className="text-slate-400 hover:text-red-600 p-1 rounded"
                                                title="Remove scenario"
                                            >
                                                <X size={14}/>
                                            </button>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            {scenarioData.map((entry) => {
                                const summary = entry.data ? getProfileSummary(entry.data.scenario, store) : null;
                                return (
                                    <th key={`${entry.id}-profiles`} colSpan={2} className="px-3 py-2 text-left min-w-[280px]">
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
                                    <th className="px-3 py-2 text-left font-bold min-w-[180px]">Assets & Debt</th>
                                    <th className="px-3 py-2 text-left font-bold min-w-[200px]">Events</th>
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
                                        <td className="px-3 py-3 min-w-[180px]">
                                            {entry.data ? renderAssetsCell(entry.data.simulation, entry.data.scenario, age) : <span className="text-xs text-slate-400">No data</span>}
                                        </td>
                                        <td className="px-3 py-3 min-w-[200px]">
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
