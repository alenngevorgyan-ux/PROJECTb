/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useWorld } from '../context/WorldContext';
import { Sparkles, Terminal, Users, Compass, X } from 'lucide-react';

export const FirstRunBanner: React.FC = () => {
  const {
    showFirstRunBanner,
    setShowFirstRunBanner,
    callVitek,
    teleportToOrganization,
    setCurrentLocation,
  } = useWorld();

  if (!showFirstRunBanner) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-11/12 max-w-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Your company is now a world.
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            Move with <strong className="text-sky-300">WASD</strong> or click anywhere.
            Approach AI employees to assign real-world tasks, walk to partner firms, or teleport via <strong className="text-sky-300">⌘K</strong>.
          </p>
        </div>

        <button
          onClick={() => setShowFirstRunBanner(false)}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
        <button
          onClick={() => {
            setShowFirstRunBanner(false);
            callVitek();
          }}
          className="flex items-center gap-2 p-2.5 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-800/60 hover:border-sky-500 rounded-lg text-left transition-all group"
        >
          <div className="p-1.5 bg-sky-600/30 rounded text-sky-400 group-hover:text-sky-300">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Call Vitek</div>
            <div className="text-[10px] text-sky-300/80">AI Engineer fixes onboarding bug</div>
          </div>
        </button>

        <button
          onClick={() => {
            setShowFirstRunBanner(false);
            teleportToOrganization('northstar-design');
          }}
          className="flex items-center gap-2 p-2.5 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/60 hover:border-indigo-500 rounded-lg text-left transition-all group"
        >
          <div className="p-1.5 bg-indigo-600/30 rounded text-indigo-400 group-hover:text-indigo-300">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Visit a partner</div>
            <div className="text-[10px] text-indigo-300/80">Joint sprint in Northstar Design</div>
          </div>
        </button>

        <button
          onClick={() => {
            setShowFirstRunBanner(false);
            setCurrentLocation('CITY');
          }}
          className="flex items-center gap-2 p-2.5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 hover:border-slate-500 rounded-lg text-left transition-all group"
        >
          <div className="p-1.5 bg-slate-700/50 rounded text-slate-300 group-hover:text-white">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Open World Map</div>
            <div className="text-[10px] text-slate-400">Explore business district & rails</div>
          </div>
        </button>
      </div>
    </div>
  );
};
