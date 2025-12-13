import React from 'react';
import { Info } from 'lucide-react';

export const TooltipHelp = ({ text }) => (
  <span className="inline-flex items-center gap-1 text-[10px] uppercase text-slate-400 font-bold">
    <Info size={12} className="text-blue-400" />
    <span>{text}</span>
  </span>
);
