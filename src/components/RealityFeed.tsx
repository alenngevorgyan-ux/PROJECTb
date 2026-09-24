/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useWorld } from '../context/WorldContext';
import { Sparkles, ArrowUpDown, Filter, Terminal, Shield, Truck, DollarSign, X } from 'lucide-react';

interface RealityFeedProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RealityFeed: React.FC<RealityFeedProps> = ({ isOpen, onClose }) => {
  const { realityEvents } = useWorld();
  const [filter, setFilter] = useState<string>('ALL');

  if (!isOpen) return null;

  const filteredEvents =
    filter === 'ALL' ? realityEvents : realityEvents.filter((e) => e.category === filter);

  return (
    <div className="w-80 sm:w-96 bg-slate-900/98 backdrop-blur-md border-l border-slate-800 flex flex-col h-full z-30 shrink-0 select-none shadow-2xl">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              Reality Feed
            </div>
            <div className="text-[10px] text-slate-400">WORLD ACTION ↕ REAL BUSINESS EVENT</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[10px]">
        {['ALL', 'DEV', 'SUPPLY', 'DESIGN', 'FINANCE', 'SUPPORT'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2 py-1 rounded font-medium transition-colors ${
              filter === cat
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredEvents.map((evt) => (
          <div
            key={evt.id}
            className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2 hover:border-slate-700 transition-colors"
          >
            {/* World Action */}
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 mt-1.5 shrink-0" />
              <div className="flex-1">
                <div className="text-[10px] font-mono text-sky-400 uppercase tracking-wider">
                  WORLD ACTION · {evt.timestamp}
                </div>
                <div className="text-xs font-semibold text-white leading-snug">
                  {evt.worldAction}
                </div>
              </div>
            </div>

            {/* Sync Divider */}
            <div className="flex items-center gap-2 pl-4 text-slate-600">
              <ArrowUpDown className="w-3 h-3 text-sky-500/70" />
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                REAL BUSINESS EVENT
              </span>
            </div>

            {/* Real Business Event */}
            <div className="pl-4">
              <div className="text-xs text-slate-300 bg-slate-900/90 p-2 rounded border border-slate-800 font-sans leading-relaxed">
                {evt.businessEvent}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
