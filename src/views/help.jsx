// src/views/help.jsx
import React, { useMemo, useState } from 'react';
import { Search, BookOpen, HelpCircle, Compass, CheckCircle2 } from 'lucide-react';

const manualSections = [
  {
    title: 'Overview',
    body: 'BA Financial Analysis helps households plan solvency using registry-first scenarios, a strict monthly engine, and cash flow tooling.'
  },
  {
    title: 'Navigation',
    body: 'Use the top bar month controls to move within the scenario window. Jump buttons snap to start/end. Sidebar tabs switch between Dashboard, Cash Flow, Assets, Loans, Ledger, Assumptions, Builder, and Compare.'
  },
  {
    title: 'Saving & Exporting',
    body: 'Use the three-dot menu to save, clone scenarios, and export full data or AI analysis snapshots. Choose a folder to persist exports when supported.'
  },
  {
    title: 'Scenario Basics',
    body: 'Scenarios overlay registry items. Link assets/liabilities and choose income/expense profiles with start months. Overrides stay scoped to the scenario.'
  },
  {
    title: 'Cash Flow & Burn',
    body: 'Plan monthly burn with property-aware housing, healthcare, liabilities, and discretionary spending. Projections tab shows net cash flow and annual tables.'
  },
  {
    title: 'Assumptions',
    body: 'Set inflation, market glide path, property tax/insurance rates, healthcare inflation, and projection horizon. These govern all simulations for the active scenario.'
  },
  {
    title: 'Troubleshooting',
    body: 'If results look off, verify profile dates, housing start/sell dates, linked loans, and horizon length. Re-run exports after major edits.'
  }
];

export default function Help() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return manualSections;
    return manualSections.filter(section =>
      section.title.toLowerCase().includes(q) || section.body.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
            <HelpCircle size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Help & User Manual</h1>
            <p className="text-slate-500 text-sm">Search guides, learn the workflow, and find quick answers.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm w-72">
          <Search size={16} className="text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the manual..."
            className="flex-1 text-sm text-slate-700 outline-none"
          />
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 font-semibold mb-1">
            <Compass size={16} className="text-blue-600" /> Quick Start
          </div>
          <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
            <li>Open Builder to set start month and link assets/liabilities.</li>
            <li>Pick income/expense profiles and start months.</li>
            <li>Adjust Assumptions (inflation, horizon, healthcare).</li>
            <li>Review Dashboard and Cash Flow; iterate profiles.</li>
            <li>Export a backup from the three-dot menu.</li>
          </ul>
        </div>
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 font-semibold mb-1">
            <BookOpen size={16} className="text-emerald-600" /> Need-to-Know
          </div>
          <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
            <li>Registry-first: scenarios reference shared assets and profiles.</li>
            <li>Housing costs come from properties or scenario rent config.</li>
            <li>Monthly engine respects the scenario start and horizon bounds.</li>
            <li>Exports omit DOM noise and store only registry + scenario data.</li>
          </ul>
        </div>
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 font-semibold mb-1">
            <CheckCircle2 size={16} className="text-amber-600" /> Tips
          </div>
          <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
            <li>Use horizon jumps to inspect end-of-plan solvency.</li>
            <li>Set healthcare inflation to reflect your market.</li>
            <li>Duplicate profiles before big edits to keep baselines.</li>
            <li>Choose an export folder to avoid default downloads.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-slate-500" />
          <h2 className="text-lg font-bold text-slate-800">Manual Topics</h2>
          <span className="text-xs text-slate-400">Showing {filtered.length} of {manualSections.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((section) => (
            <article key={section.title} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-1">{section.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{section.body}</p>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="p-6 bg-white border border-slate-200 rounded-lg text-center text-slate-500">
              No topics match “{query}”. Try a different keyword.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
