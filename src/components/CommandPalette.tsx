/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useWorld } from '../context/WorldContext';
import { Search, Building, Terminal, Users, DollarSign, ArrowRight, ShieldCheck, Mail, X } from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  badge?: string;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    showCommandPalette,
    setShowCommandPalette,
    organizations,
    teleportToOrganization,
    teleportToRoom,
    callVitek,
    setShowTreasuryModal,
    setShowPRModal,
  } = useWorld();

  const [query, setQuery] = useState('');

  useEffect(() => {
    if (showCommandPalette) {
      setQuery('');
    }
  }, [showCommandPalette]);

  if (!showCommandPalette) return null;

  // Search items
  const items: CommandItem[] = [
    // Organizations
    ...organizations.map((org) => ({
      id: `org-${org.id}`,
      title: org.name,
      subtitle: `${org.isVerified ? '✓ Verified Partner' : 'External / Unclaimed'} · ${org.communicationRail} rail`,
      category: 'Organizations',
      badge: org.isVerified ? 'VERIFIED' : 'EXTERNAL',
      action: () => {
        teleportToOrganization(org.id);
        setShowCommandPalette(false);
      },
    })),
    // Rooms
    {
      id: 'room-eng',
      title: 'Engineering Bay (Vitek’s Desk)',
      subtitle: 'My Company · Active code pipelines & repository terminal',
      category: 'Rooms & Locations',
      action: () => {
        teleportToOrganization('my-company');
        teleportToRoom('engineering');
        setShowCommandPalette(false);
      },
    },
    {
      id: 'room-apollo',
      title: 'Project Apollo Suite',
      subtitle: 'Northstar Design · Cross-company collaboration room',
      category: 'Rooms & Locations',
      action: () => {
        teleportToOrganization('northstar-design');
        teleportToRoom('project-apollo-room');
        setShowCommandPalette(false);
      },
    },
    {
      id: 'room-finance',
      title: 'Finance & Treasury Vault',
      subtitle: 'My Company · Live balance, spending rules & pending invoices',
      category: 'Rooms & Locations',
      action: () => {
        teleportToOrganization('my-company');
        teleportToRoom('finance');
        setShowCommandPalette(false);
      },
    },
    // Actions & Agents
    {
      id: 'act-vitek',
      title: 'Call Vitek to Executive Desk',
      subtitle: 'AI Engineer · Run onboarding state bug fix and open PR',
      category: 'Agent Directives',
      action: () => {
        teleportToOrganization('my-company');
        setShowCommandPalette(false);
        callVitek();
      },
    },
    {
      id: 'act-pr',
      title: 'View Pull Request #184',
      subtitle: 'Vitek · Auth signup state fix (42/42 tests passing)',
      category: 'Tasks & Repositories',
      action: () => {
        setShowCommandPalette(false);
        setShowPRModal(true);
      },
    },
    {
      id: 'act-treasury',
      title: 'Review Treasury & Invoice #511',
      subtitle: 'Acme Manufacturing · $418.00 revised payment authorization',
      category: 'Finance & Treasury',
      action: () => {
        setShowCommandPalette(false);
        setShowTreasuryModal(true);
      },
    },
  ];

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150"
      onClick={() => setShowCommandPalette(false)}
    >
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-sky-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a company, room, agent, or command (e.g. Acme, Vitek)..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={() => setShowCommandPalette(false)}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching destinations or directives found.
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full text-left p-3 hover:bg-slate-800/70 rounded-lg flex items-center justify-between group transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white group-hover:text-sky-300 transition-colors">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                          item.badge === 'VERIFIED'
                            ? 'bg-sky-950 text-sky-300 border border-sky-800/50'
                            : 'bg-amber-950 text-amber-300 border border-amber-800/50'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{item.subtitle}</div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 group-hover:text-sky-400 transition-colors">
                  <span className="text-[10px] bg-slate-800 px-2 py-1 rounded border border-slate-700/60">
                    ENTER ↵
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Walking is optional · Teleport directly anywhere in Business World</span>
          <kbd className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">
            ESC to close
          </kbd>
        </div>
      </div>
    </div>
  );
};
