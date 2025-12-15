// src/views/dashboard.jsx
import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { runFinancialSimulation } from '../utils/financial_engine';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, Legend, Line } from 'recharts';
import { TrendingUp, AlertTriangle, DollarSign, Activity } from 'lucide-react';

// --- CUSTOM TOOLTIP ---
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-xl text-xs z-50">
                <div className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">
                    Year: {data.year} (Primary: {data.age}, Spouse: {data.spouseAge})
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between gap-4 text-emerald-600">
                        <span>Property:</span><span className="font-mono">${Math.round(data.balances.property).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-blue-600">
                        <span>Liquid Assets:</span><span className="font-mono">${Math.round(data.balances.liquid + data.balances.retirement + data.balances.inherited).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-red-500 border-t border-red-50 pt-1 mt-1">
                        <span>Liabilities:</span><span className="font-mono">-${Math.round(data.balances.totalDebt).toLocaleString()}</span>
                    </div>
                    {data.balances.reverseMortgage > 0 && (
                        <div className="flex justify-between gap-4 text-orange-500">
                            <span>Reverse Mort:</span><span className="font-mono">-${Math.round(data.balances.reverseMortgage).toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between gap-4 font-bold text-slate-800 border-t border-slate-100 pt-1 mt-1">
                        <span>Net Worth:</span><span>${Math.round(data.netWorth).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

// --- SUB-COMPONENTS ---
const MetricCard = ({ label, value, sublabel, icon: Icon, color = "blue" }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
        <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
            {sublabel && <div className="text-xs text-slate-400 mt-1">{sublabel}</div>}
        </div>
        <div className={`p-3 rounded-full bg-${color}-50 text-${color}-500`}>
            <Icon size={24} />
        </div>
    </div>
);

const EventLog = ({ events }) => (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-full">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Activity size={18} className="text-blue-500" />
                Simulation Events
            </h3>
            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{events.length} Events</span>
        </div>
        <div className="p-0 overflow-y-auto max-h-[300px]">
            {events.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">No critical events detected in 35-year run.</div>
            ) : (
                <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-slate-50">
                        {events.map((ev, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-6 py-3 font-mono text-slate-500 text-xs w-32">
                                    {ev.date}
                                    {/* Display Primary Age Context */}
                                    {ev.primaryAge && <span className="block text-slate-400 font-sans mt-0.5">Age {ev.primaryAge}</span>}
                                </td>
                                <td className="px-6 py-3 text-slate-700 font-medium">{ev.text}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    </div>
);

export default function Dashboard() {
    const { activeScenario, store } = useData();

    // --- 1. RUN SIMULATION ---
    const simulation = useMemo(() => {
        return runFinancialSimulation(activeScenario, store.profiles);
    }, [activeScenario, store.profiles]);

    const { timeline, events } = simulation;

    // --- 2. PREPARE CHART DATA ---
    const chartData = useMemo(() => {
        if (!timeline || timeline.length === 0) return [];
        const filtered = timeline.filter(t => t.month === 12 || t.month === 0);

        return filtered.map(t => ({
            ...t,
            // Assets (Positive)
            assetCash: t.balances.cash,
            assetJoint: t.balances.joint,
            assetRetire: t.balances.retirement,
            assetIra: t.balances.inherited,
            assetProperty: t.balances.property,
            // Liabilities (Negative)
            debtStandard: -t.balances.totalDebt,
            debtReverse: -t.balances.reverseMortgage,
            // FIX: Map the correct accumulated annual total for the Cash Flow Chart
            annualNetCashFlow: t.annualData.netCashFlow
        }));
    }, [timeline]);

    // --- 3. CALCULATE METRICS ---
    const lastPoint = timeline[timeline.length - 1] || {};
    const endingCash = lastPoint.balances?.cash || 0;
    const endingJoint = lastPoint.balances?.joint || 0;
    const endingInherited = lastPoint.balances?.inherited || 0;
    const endingRetirement = lastPoint.balances?.retirement || 0;
    const endingLiquid = endingCash + endingJoint + endingInherited + endingRetirement;
    const firstPoint = timeline[0] || {};

    const startNW = firstPoint.netWorth || 0;
    const endNW = lastPoint.netWorth || 0;
    const nwGrowth = endNW - startNW;

    const isSolvent = !events.some(e => e.text.includes("Depleted") && e.text.includes("Reverse Mortgage"));

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">

            {/* TOP METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    label="Proj. Net Worth (35yr)"
                    value={`$${(endNW / 1000000).toFixed(2)}M`}
                    sublabel={`Growth: +$${(nwGrowth / 1000000).toFixed(2)}M`}
                    icon={TrendingUp}
                    color="emerald"
                />
                <MetricCard
                    label="Ending Liquidity"
                    value={`$${Math.round(endingLiquid/1000)}k`}
                    sublabel="Cash + Joint + Inherited + Retirement"
                    icon={DollarSign}
                    color="blue"
                />
                <MetricCard
                    label="R-HELOC Balance"
                    value={`$${Math.round((lastPoint.balances?.reverseMortgage || 0)/1000)}k`}
                    sublabel={lastPoint.balances?.reverseMortgage > 0 ? "Active in Final Year" : "Not Utilized"}
                    icon={AlertTriangle}
                    color={lastPoint.balances?.reverseMortgage > 0 ? "orange" : "slate"}
                />
                <MetricCard
                    label="Plan Status"
                    value={isSolvent ? "Solvent" : "Review"}
                    sublabel="35-Year Horizon"
                    icon={Activity}
                    color={isSolvent ? "green" : "red"}
                />
            </div>

            {/* CHART ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-96">

                {/* MAIN BALANCE SHEET CHART */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="font-bold text-slate-700 mb-6">Projected Assets vs. Liabilities</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} stackOffset="sign">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => `$${v/1000000}M`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{fontSize:'10px', paddingTop:'10px'}} />
                                <ReferenceLine y={0} stroke="#94a3b8" />

                                {/* ASSETS (Positive Stack) */}
                                <Bar dataKey="assetProperty" stackId="a" fill="#10b981" name="Property" />
                                <Bar dataKey="assetRetire" stackId="a" fill="#3b82f6" name="Retirement" />
                                <Bar dataKey="assetIra" stackId="a" fill="#6366f1" name="Inherited IRA" />
                                <Bar dataKey="assetJoint" stackId="a" fill="#8b5cf6" name="Joint Inv." />
                                <Bar dataKey="assetCash" stackId="a" fill="#ec4899" name="Cash" />

                                {/* LIABILITIES (Negative Stack) */}
                                <Bar dataKey="debtStandard" stackId="a" fill="#ef4444" name="Mortgages/Loans" />
                                <Bar dataKey="debtReverse" stackId="a" fill="#f97316" name="Reverse Mortgage" />

                                {/* NET WORTH LINE */}
                                <Line type="monotone" dataKey="netWorth" stroke="#0f172a" strokeWidth={2} dot={false} name="Net Worth" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* EVENTS LIST */}
                <EventLog events={events} />
            </div>

            {/* SECONDARY CHART: CASH FLOW */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80 flex flex-col">
                <h3 className="font-bold text-slate-700 mb-6">Annual Net Cash Flow (Income - Expenses)</h3>
                <div className="flex-1 min-h-0">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => `$${v/1000}k`} />
                            <Tooltip
                                cursor={{fill: 'transparent'}}
                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                formatter={(val) => [`$${Math.round(val).toLocaleString()}`, 'Annual Surplus/Deficit']}
                            />
                            <ReferenceLine y={0} stroke="#94a3b8" />
                            <Bar dataKey="annualNetCashFlow" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={index} fill={entry.annualNetCashFlow >= 0 ? '#3b82f6' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
