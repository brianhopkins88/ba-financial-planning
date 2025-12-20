import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { runFinancialSimulation } from '../utils/financial_engine.js';
import { ensureScenarioShape } from '../utils/scenario_shape.js';
import { cloneDeep } from 'lodash';
import { Plus, X, ChevronDown, ChevronRight, ArrowLeft, ArrowRight, Download, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ages = [65, 70, 75, 80, 85, 90];
const MAX_COLUMNS = 4;
const metricOptions = [
    { value: 'netWorth', label: 'Net Worth (default)' },
    { value: 'cash', label: 'Cash' },
    { value: 'joint', label: 'Joint' },
    { value: 'inherited', label: 'Inherited' },
    { value: 'retirement', label: 'Retirement' },
    { value: 'property', label: 'Property' },
    { value: 'reverseMortgage', label: 'Reverse Mortgage' },
    { value: 'totalDebt', label: 'Total Debt' }
];

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

const csvEscape = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const buildCompareCsv = (scenarioData, store, scenarioNames) => {
    const headers = [
        'columnIndex',
        'scenarioId',
        'scenarioName',
        'age',
        'snapshotYear',
        'netWorth',
        'cash',
        'joint',
        'inherited',
        'retirement',
        'property',
        'reverseMortgage',
        'totalDebt',
        'eventCount',
        'events',
        'incomeProfileName',
        'incomeProfileStart',
        'expenseProfileName',
        'expenseProfileStart'
    ];

    const rows = [];
    scenarioData.forEach((entry, idx) => {
        if (!entry.data) return;
        const scen = entry.data.scenario;
        const sim = entry.data.simulation;
        const summary = getProfileSummary(scen, store);
        ages.forEach(age => {
            const snap = pickSnapshotByAge(sim, scen, age);
            const events = eventsUpToAge(sim, scen, age);
            rows.push({
                columnIndex: idx + 1,
                scenarioId: entry.id,
                scenarioName: scen?.name || scenarioNames[entry.id] || '',
                age,
                snapshotYear: snap?.year || '',
                netWorth: snap ? Math.round(snap.netWorth || 0) : '',
                cash: snap ? Math.round(snap.cash || 0) : '',
                joint: snap ? Math.round(snap.joint || 0) : '',
                inherited: snap ? Math.round(snap.inherited || 0) : '',
                retirement: snap ? Math.round(snap.retirement || 0) : '',
                property: snap ? Math.round(snap.property || 0) : '',
                reverseMortgage: snap ? Math.round(snap.reverseMortgage || 0) : '',
                totalDebt: snap ? Math.round(snap.totalDebt || 0) : '',
                eventCount: events.length,
                events: events.map(e => `${e.date}: ${e.text}`).join(' | '),
                incomeProfileName: summary?.income?.name || '',
                incomeProfileStart: summary?.income?.start || '',
                expenseProfileName: summary?.expense?.name || '',
                expenseProfileStart: summary?.expense?.start || ''
            });
        });
    });

    const lines = [headers.join(',')];
    rows.forEach(row => {
        lines.push(headers.map(key => csvEscape(row[key])).join(','));
    });
    return lines.join('\n');
};

const cleanText = (value) => {
    if (!value) return '';
    return String(value).replace(/\s+/g, ' ').trim();
};

const formatCurrency = (value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
    const rounded = Math.round(value);
    const abs = Math.abs(rounded).toLocaleString();
    return `${rounded < 0 ? '-' : ''}$${abs}`;
};

const formatMonthYear = (dateStr) => {
    if (!dateStr) return 'n/a';
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;
    const [year, month] = parts;
    const monthIndex = parseInt(month, 10) - 1;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return dateStr;
    return `${monthNames[monthIndex]} ${year}`;
};

const formatYearRanges = (years) => {
    if (!years || years.length === 0) return 'none';
    const sorted = Array.from(new Set(years)).sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i += 1) {
        const yr = sorted[i];
        if (yr === prev + 1) {
            prev = yr;
            continue;
        }
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = yr;
        prev = yr;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return ranges.join(', ');
};

const formatChartValue = (value) => {
    const abs = Math.abs(value || 0);
    if (abs >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
    if (abs >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return `${Math.round(value || 0)}`;
};

const escapeXml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const getScenarioDescription = (scenario) => {
    const raw = scenario?.description || scenario?.textConfig?.narrative || '';
    return cleanText(raw) || 'No description provided.';
};

const getHelocPayoffDate = (simulation) => {
    const events = simulation?.events || [];
    const helocEvents = events.filter(e => /heloc/i.test(e.text || ''));
    if (!helocEvents.length) return null;
    helocEvents.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return helocEvents[0]?.date || null;
};

const getRetirementDeclineYear = (simulation) => {
    const timeline = simulation?.timeline || [];
    const yearEndBalances = {};
    timeline.forEach(item => {
        const year = item.year;
        const month = item.month || 1;
        const balance = item.balances?.retirement || 0;
        if (!yearEndBalances[year] || month >= yearEndBalances[year].month) {
            yearEndBalances[year] = { month, balance };
        }
    });
    const years = Object.keys(yearEndBalances).map(Number).sort((a, b) => a - b);
    let sawIncrease = false;
    let prev = null;
    for (const year of years) {
        const current = yearEndBalances[year].balance;
        if (prev !== null) {
            const delta = current - prev;
            if (delta > 0) sawIncrease = true;
            if (delta < 0 && sawIncrease) return year;
        }
        prev = current;
    }
    return null;
};

const getReverseMortgageYears = (simulation) => {
    const timeline = simulation?.timeline || [];
    const years = [];
    timeline.forEach(item => {
        if ((item.balances?.reverseMortgage || 0) > 0) years.push(item.year);
    });
    return formatYearRanges(years);
};

const getForcedSaleYears = (simulation) => {
    const events = simulation?.events || [];
    const years = events
        .filter(e => /forced sale/i.test(e.text || ''))
        .map(e => parseInt((e.date || '').slice(0, 4), 10))
        .filter(yr => !Number.isNaN(yr));
    return formatYearRanges(years);
};

const buildScenarioMilestones = (simulation, scenario) => {
    const netCashflow = (simulation?.timeline || []).reduce((sum, item) => {
        if (item.year >= 2026 && item.year <= 2029) {
            return sum + (item.netCashFlow || ((item.income || 0) - (item.expenses || 0)));
        }
        return sum;
    }, 0);
    const helocDate = getHelocPayoffDate(simulation);
    const age85 = pickSnapshotByAge(simulation, scenario, 85);
    const retireDeclineYear = getRetirementDeclineYear(simulation);
    const rmYears = getReverseMortgageYears(simulation);
    const forcedYears = getForcedSaleYears(simulation);
    return [
        `Net cashflow 2026-2029 (income - expenses): ${formatCurrency(netCashflow)}`,
        `HELOC paid: ${formatMonthYear(helocDate)}`,
        `At 85: Net worth ${formatCurrency(age85?.netWorth)}; Retirement ${formatCurrency(age85?.retirement)}`,
        `401K turns down: ${retireDeclineYear || 'n/a'}`,
        `Reverse mortgage years: ${rmYears}; Forced sale years: ${forcedYears}`
    ];
};

const buildChartData = (scenarioData, metric) => {
    const merged = new Map();
    scenarioData.forEach(entry => {
        const timeline = entry.data?.simulation?.timeline || [];
        timeline.forEach(point => {
            const monthIndex = (point.month || 1) - 1;
            const date = new Date(point.year, monthIndex, 1);
            const key = `${point.year}-${String(point.month || 1).padStart(2, '0')}`;
            if (!merged.has(key)) {
                merged.set(key, { dateLabel: date.toLocaleString('default', { month: 'short', year: 'numeric' }), dateValue: date.getTime() });
            }
            const value = metric === 'netWorth' ? point.netWorth : point.balances?.[metric];
            merged.get(key)[entry.id] = Math.round(value || 0);
        });
    });
    return Array.from(merged.values())
        .sort((a, b) => a.dateValue - b.dateValue)
        .map(row => {
            const { dateValue, ...rest } = row;
            return rest;
        });
};

const buildNetWorthChartSvg = (chartData, scenarioData, scenarioNames, colors) => {
    if (!chartData.length) return '';
    const width = 900;
    const height = 320;
    const padding = { left: 60, right: 160, top: 20, bottom: 40 };
    const seriesIds = scenarioData.map(entry => entry.id);
    const values = [];
    chartData.forEach(row => {
        seriesIds.forEach(id => {
            const v = row[id];
            if (typeof v === 'number' && !Number.isNaN(v)) values.push(v);
        });
    });
    if (!values.length) return '';
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const xCount = chartData.length;
    const xScale = (idx) => {
        if (xCount <= 1) return padding.left;
        return padding.left + (idx / (xCount - 1)) * (width - padding.left - padding.right);
    };
    const yScale = (val) => padding.top + (1 - (val - min) / (max - min)) * (height - padding.top - padding.bottom);

    const gridLines = 4;
    const gridStep = (max - min) / gridLines;
    const grid = [];
    for (let i = 0; i <= gridLines; i += 1) {
        const value = min + (gridStep * i);
        const y = yScale(value);
        grid.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />`);
        grid.push(`<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#475569">${escapeXml(formatChartValue(value))}</text>`);
    }

    const lines = [];
    seriesIds.forEach((id, idx) => {
        const segments = [];
        let current = [];
        chartData.forEach((row, rowIdx) => {
            const value = row[id];
            if (value === undefined || value === null || Number.isNaN(value)) {
                if (current.length) {
                    segments.push(current);
                    current = [];
                }
                return;
            }
            const x = xScale(rowIdx);
            const y = yScale(value);
            current.push(`${x},${y}`);
        });
        if (current.length) segments.push(current);
        segments.forEach(points => {
            lines.push(`<polyline fill="none" stroke="${colors[idx % colors.length]}" stroke-width="2" points="${points.join(' ')}" />`);
        });
    });

    const firstLabel = chartData[0]?.dateLabel || '';
    const midLabel = chartData[Math.floor(chartData.length / 2)]?.dateLabel || '';
    const lastLabel = chartData[chartData.length - 1]?.dateLabel || '';
    const xAxisLabels = [
        `<text x="${padding.left}" y="${height - 10}" font-size="10" fill="#475569">${escapeXml(firstLabel)}</text>`,
        `<text x="${xScale(Math.floor(chartData.length / 2))}" y="${height - 10}" font-size="10" fill="#475569" text-anchor="middle">${escapeXml(midLabel)}</text>`,
        `<text x="${width - padding.right}" y="${height - 10}" font-size="10" fill="#475569" text-anchor="end">${escapeXml(lastLabel)}</text>`
    ];

    const legend = seriesIds.map((id, idx) => {
        const name = scenarioNames[id] || `Scenario ${idx + 1}`;
        const y = padding.top + (idx * 16);
        const x = width - padding.right + 10;
        return [
            `<rect x="${x}" y="${y - 9}" width="10" height="10" fill="${colors[idx % colors.length]}" />`,
            `<text x="${x + 14}" y="${y}" font-size="10" fill="#475569">${escapeXml(name)}</text>`
        ].join('');
    }).join('');

    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        `<rect x="0" y="0" width="${width}" height="${height}" fill="white" />`,
        `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#94a3b8" stroke-width="1" />`,
        `<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#94a3b8" stroke-width="1" />`,
        grid.join(''),
        lines.join(''),
        xAxisLabels.join(''),
        legend,
        `</svg>`
    ].join('');
};

const svgToDataUri = (svg) => {
    if (!svg) return '';
    const encoded = encodeURIComponent(svg).replace(/%0A/g, '');
    return `data:image/svg+xml;utf8,${encoded}`;
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
    const scenarioNames = useMemo(() => {
        const map = {};
        scenarioOptions.forEach(s => { map[s.id] = s.name; });
        return map;
    }, [scenarioOptions]);

    const initialIds = useMemo(() => {
        const ids = scenarioOptions.map(s => s.id);
        const primary = activeScenario?.id || ids[0];
        return primary ? [primary] : [];
    }, [scenarioOptions, activeScenario]);

    const [selected, setSelected] = useState(initialIds);
    const [chartMetric, setChartMetric] = useState('netWorth');
    const [expandedAges, setExpandedAges] = useState(() => new Set());

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

    const toggleAgeRow = useCallback((age) => {
        setExpandedAges(prev => {
            const next = new Set(prev);
            if (next.has(age)) next.delete(age); else next.add(age);
            return next;
        });
    }, []);

    const expandAllYears = useCallback(() => setExpandedAges(new Set(ages)), []);
    const collapseAllYears = useCallback(() => setExpandedAges(new Set()), []);

    const addColumn = () => {
        if (selected.length >= MAX_COLUMNS) return;
        const unused = scenarioOptions.find(s => !selected.includes(s.id));
        if (unused) setSelected([...selected, unused.id]);
    };

    const removeColumn = (idx) => {
        if (idx === 0) return; // always keep the first column
        setSelected(selected.filter((_, i) => i !== idx));
    };

    const moveColumn = useCallback((idx, dir) => {
        const next = [...selected];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return;
        [next[idx], next[target]] = [next[target], next[idx]];
        setSelected(next);
    }, [selected]);

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

    const handleExportCsv = useCallback(() => {
        const csv = buildCompareCsv(scenarioData, store, scenarioNames);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `scenario_compare_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [scenarioData, store, scenarioNames]);

    const chartData = useMemo(() => buildChartData(scenarioData, chartMetric), [scenarioData, chartMetric]);

    const chartMetricLabel = metricOptions.find(opt => opt.value === chartMetric)?.label || 'Net Worth';
    const allExpanded = expandedAges.size === ages.length;
    const anyExpanded = expandedAges.size > 0;
    const chartColors = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444'];
    const ageColWidth = 90;
    const scenarioColWidth = useMemo(() => {
        const cols = Math.max(1, selected.length * 2);
        return `calc((100% - ${ageColWidth}px) / ${cols})`;
    }, [selected.length, ageColWidth]);

    const handleExportMarkdown = useCallback(() => {
        const netWorthData = buildChartData(scenarioData, 'netWorth');
        const svg = buildNetWorthChartSvg(netWorthData, scenarioData, scenarioNames, chartColors);
        const chartUri = svgToDataUri(svg);
        const lines = [];
        lines.push('# Scenario Comparison Report');
        lines.push('');
        lines.push(`Generated: ${new Date().toISOString()}`);
        lines.push('');
        if (chartUri) {
            lines.push('## Net Worth Chart');
            lines.push('');
            lines.push(`![Net Worth Chart](${chartUri})`);
            lines.push('');
        }
        lines.push('## Scenario Summaries');
        lines.push('');
        scenarioData.forEach((entry, idx) => {
            const scen = entry.data?.scenario;
            const sim = entry.data?.simulation;
            const name = scen?.name || scenarioNames[entry.id] || `Scenario ${idx + 1}`;
            lines.push(`### ${name}`);
            lines.push('');
            lines.push(`**Description:** ${getScenarioDescription(scen)}`);
            lines.push('');
            const milestones = sim && scen ? buildScenarioMilestones(sim, scen) : [];
            if (milestones.length) {
                lines.push('**Major milestones:**');
                milestones.forEach(item => lines.push(`- ${item}`));
                lines.push('');
            } else {
                lines.push('**Major milestones:** n/a');
                lines.push('');
            }
        });
        lines.push('## Age Details');
        lines.push('');
        ages.forEach(age => {
            lines.push(`### Age ${age}`);
            lines.push('');
            scenarioData.forEach((entry, idx) => {
                const scen = entry.data?.scenario;
                const sim = entry.data?.simulation;
                const name = scen?.name || scenarioNames[entry.id] || `Scenario ${idx + 1}`;
                lines.push(`#### ${name}`);
                if (!scen || !sim) {
                    lines.push('No data available.');
                    lines.push('');
                    return;
                }
                const snap = pickSnapshotByAge(sim, scen, age);
                if (!snap) {
                    lines.push('No snapshot data available.');
                    lines.push('');
                    return;
                }
                lines.push('- Assets & Debt:');
                lines.push(`  - Net Worth: ${formatCurrency(snap.netWorth)}`);
                lines.push(`  - Cash: ${formatCurrency(snap.cash)}`);
                lines.push(`  - Joint: ${formatCurrency(snap.joint)}`);
                lines.push(`  - Inherited: ${formatCurrency(snap.inherited)}`);
                lines.push(`  - Retirement: ${formatCurrency(snap.retirement)}`);
                lines.push(`  - Property: ${formatCurrency(snap.property)}`);
                lines.push(`  - Reverse Mortgage: ${formatCurrency(snap.reverseMortgage)}`);
                lines.push(`  - Other Debt: ${formatCurrency(snap.totalDebt)}`);
                const events = eventsUpToAge(sim, scen, age);
                lines.push(`- Events (${events.length}):`);
                if (events.length) {
                    events.forEach(ev => lines.push(`  - ${ev.date} ${ev.text}`));
                } else {
                    lines.push('  - None');
                }
                lines.push('');
            });
        });

        const markdown = lines.join('\n');
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `scenario_compare_report_${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [scenarioData, scenarioNames, chartColors]);

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
                    <p className="text-sm text-slate-500">Select up to four scenarios and compare profiles, net worth milestones, and major events side-by-side.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={expandAllYears}
                            disabled={allExpanded}
                            className={`px-3 py-2 text-sm rounded border ${allExpanded ? 'text-slate-400 border-slate-200 bg-slate-50' : 'text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                        >
                            Expand All
                        </button>
                        <button
                            onClick={collapseAllYears}
                            disabled={!anyExpanded}
                            className={`px-3 py-2 text-sm rounded border ${!anyExpanded ? 'text-slate-400 border-slate-200 bg-slate-50' : 'text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                        >
                            Collapse All
                        </button>
                    </div>
                    <button
                        onClick={handleExportCsv}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 text-sm rounded border border-slate-200 hover:bg-slate-200"
                    >
                        <Download size={14}/> Export CSV
                    </button>
                    <button
                        onClick={handleExportMarkdown}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 text-sm rounded border border-slate-200 hover:bg-slate-200"
                    >
                        <FileText size={14}/> Export Markdown
                    </button>
                    {selected.length < MAX_COLUMNS && (
                        <button onClick={addColumn} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded shadow hover:bg-blue-700">
                            <Plus size={14}/> Add Scenario
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-6">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                    <div>
                        <div className="text-sm font-semibold text-slate-800">Trajectory chart</div>
                        <p className="text-xs text-slate-500">Net worth by default; switch metrics to inspect individual balance components.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase text-slate-500 font-bold">Metric</span>
                        <select
                            value={chartMetric}
                            onChange={(e) => setChartMetric(e.target.value)}
                            className="border border-slate-300 rounded px-3 py-2 text-sm bg-white text-slate-700"
                        >
                            {metricOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {chartData.length ? (
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#475569' }} minTickGap={24} />
                                <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => `$${Math.round(v / 1000).toLocaleString()}k`} />
                                <Tooltip
                                    formatter={(value) => [`$${Math.round(value).toLocaleString()}`, chartMetricLabel]}
                                    labelFormatter={(label) => label}
                                />
                                <Legend />
                                {scenarioData.filter(entry => entry.data?.simulation?.timeline?.length).map((entry, idx) => (
                                    <Line
                                        key={entry.id}
                                        type="monotone"
                                        dataKey={entry.id}
                                        name={scenarioNames[entry.id] || `Scenario ${idx + 1}`}
                                        stroke={chartColors[idx % chartColors.length]}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-sm text-slate-500">No chart data available for the selected scenarios.</div>
                )}
            </div>

            <div className="overflow-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                <table className="w-full min-w-full text-sm table-fixed">
                    <colgroup>
                        <col style={{ width: `${ageColWidth}px` }} />
                        {scenarioData.map(entry => (
                            <React.Fragment key={`colgroup-${entry.id}`}>
                                <col style={{ width: scenarioColWidth }} />
                                <col style={{ width: scenarioColWidth }} />
                            </React.Fragment>
                        ))}
                    </colgroup>
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th rowSpan={4} className="px-3 py-3 text-left text-xs font-bold text-slate-600 uppercase w-16">Age</th>
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
                                        <div className="flex items-center gap-1">
                                            {idx > 0 && (
                                                <button
                                                    onClick={() => moveColumn(idx, -1)}
                                                    className="text-slate-400 hover:text-slate-700 p-1 rounded"
                                                    title="Move column left"
                                                >
                                                    <ArrowLeft size={14}/>
                                                </button>
                                            )}
                                            {idx < selected.length - 1 && (
                                                <button
                                                    onClick={() => moveColumn(idx, 1)}
                                                    className="text-slate-400 hover:text-slate-700 p-1 rounded"
                                                    title="Move column right"
                                                >
                                                    <ArrowRight size={14}/>
                                                </button>
                                            )}
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
                                    </div>
                                </th>
                            ))}
                        </tr>
                        <tr className="bg-slate-50 border-b border-slate-200">
                        {scenarioData.map((entry) => {
                            const description = entry.data ? getScenarioDescription(entry.data.scenario) : null;
                            return (
                                <th key={`${entry.id}-profiles`} colSpan={2} className="px-3 py-2 text-left min-w-[280px]">
                                    {description ? (
                                        <div className="text-xs text-slate-700 space-y-1">
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Description</div>
                                            <div className="leading-relaxed">{description}</div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-400">No description</div>
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                        <tr className="bg-white border-b border-slate-200">
                            {scenarioData.map((entry) => {
                                if (!entry.data) {
                                    return (
                                        <th key={`${entry.id}-highlights`} colSpan={2} className="px-3 py-2 text-left min-w-[280px] text-xs text-slate-400">
                                            No highlights available
                                        </th>
                                    );
                                }
                                const sim = entry.data.simulation;
                                const scen = entry.data.scenario;
                                const milestones = buildScenarioMilestones(sim, scen);
                                return (
                                    <th key={`${entry.id}-highlights`} colSpan={2} className="px-3 py-2 text-left min-w-[280px]">
                                        <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                                            {milestones.map(item => (
                                                <li key={`${entry.id}-${item}`}>{item}</li>
                                            ))}
                                        </ul>
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
                        {ages.map(age => {
                            const isOpen = expandedAges.has(age);
                            return (
                                <React.Fragment key={age}>
                                    <tr className="border-b border-slate-100 bg-white">
                                        <td className="px-3 py-3 text-sm font-bold text-slate-700 bg-slate-50">
                                            <button
                                                onClick={() => toggleAgeRow(age)}
                                                className="flex items-center gap-2 text-slate-700"
                                                title={isOpen ? 'Collapse year details' : 'Expand year details'}
                                            >
                                                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                <span>Age {age}</span>
                                            </button>
                                        </td>
                                        {scenarioData.map(entry => {
                                            const snap = entry.data ? pickSnapshotByAge(entry.data.simulation, entry.data.scenario, age) : null;
                                            const netWorth = snap ? Math.round(snap.netWorth || 0).toLocaleString() : null;
                                            const eventCount = entry.data ? eventsUpToAge(entry.data.simulation, entry.data.scenario, age).length : 0;
                                            return (
                                                <td key={`${entry.id}-summary-${age}`} colSpan={2} className="px-3 py-3 min-w-[200px]">
                                                    {snap ? (
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-sm font-semibold text-slate-800">${netWorth}</div>
                                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                                <span>{eventCount} events</span>
                                                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-[11px]">Summary</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-400">No data</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    {isOpen && (
                                        <tr className="border-b border-slate-100 align-top">
                                            <td className="px-3 py-4 text-xs font-semibold text-slate-500 bg-slate-50">Details</td>
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
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
