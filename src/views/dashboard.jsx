import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { runFinancialSimulation } from '../utils/financial_engine';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { TrendingUp, AlertTriangle, DollarSign, Activity } from 'lucide-react';

// --- CUSTOM TOOLTIP ---
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-xl text-xs">
                <div className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1">
                    Year: {data.year}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-slate-500">
                    <div>Brian Age: <span className="font-bold text-slate-700">{data.age}</span></div>
                    <div>Andrea Age: <span className="font-bold text-slate-700">{data.andreaAge}</span></div>
                </div>
                <div className="flex justify-between items-center gap-4">
                    <span className="text-slate-500">Net Worth:</span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">
                        ${Math.round(data.netWorth).toLocaleString()}
                    </span>
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
                                <td className="px-6 py-3 font-mono text-slate-500 text-xs w-32">{ev.date}</td>
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
        return timeline.filter(t => t.month === 12 || t === timeline[timeline.length - 1]);
    }, [timeline]);

    // --- 3. CALCULATE METRICS ---
    const lastPoint = timeline[timeline.length - 1] || {};
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
                    value={`$${Math.round((lastPoint.balances?.liquid || 0)/1000)}k`}
                    sublabel="Cash + Joint Accounts"
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

                {/* MAIN NET WORTH CHART */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="font-bold text-slate-700 mb-6">Net Worth Projection</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorNw" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => `$${v/1000000}M`} />
                                {/* UPDATED TOOLTIP */}
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="netWorth" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorNw)" />
                            </AreaChart>
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
                            <Bar dataKey="netCashFlow" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={index} fill={entry.netCashFlow >= 0 ? '#3b82f6' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}