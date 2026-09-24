/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useWorld } from '../context/WorldContext';
import {
  Sparkles,
  Info,
  RotateCcw,
  ShieldAlert,
  GitPullRequest,
  Mail,
  CreditCard,
  Cloud,
  ChevronDown,
  X,
  CheckCircle2,
} from 'lucide-react';

export const DemoModeBadge: React.FC = () => {
  const { resetDemo } = useWorld();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowConfirmReset(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleReset = () => {
    resetDemo();
    setShowConfirmReset(false);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold tracking-wide bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 transition-all shadow-sm group active:scale-95"
        title="Interactive Simulation Details & Reset"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="hidden sm:inline">DEMO MODE ·</span>
        <span>Simulated external actions</span>
        <ChevronDown className={`w-3 h-3 text-amber-400/80 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-4 text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-950/90 text-amber-400 rounded-md border border-amber-800/60">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white text-xs">Interactive Prototype</h4>
                <p className="text-[10px] text-slate-400">Deterministic sandbox simulation</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="mt-3 text-[11px] text-slate-300 leading-relaxed">
            This interactive world demonstrates how autonomous agents and corporate rails collaborate.
            <strong> All external operations are executed in-memory as safe simulations.</strong> No live funds, emails, or production repositories are modified.
          </p>

          {/* Simulated rails checklist */}
          <div className="mt-3 p-2.5 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-1.5 font-mono text-[10px]">
            <div className="flex items-center gap-2 text-slate-300">
              <GitPullRequest className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Simulated GitHub PRs & CI pipeline</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Simulated Asynchronous Supplier Email Rail</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Simulated Treasury Vault & Idempotent Approvals</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Cloud className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Simulated Customer Access & Entitlement Ledger</span>
            </div>
          </div>

          {/* Reset Demo Action */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Restore clean demo state:</span>
            {!showConfirmReset ? (
              <button
                onClick={() => setShowConfirmReset(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-md text-[11px] font-semibold transition-colors border border-slate-700/60"
              >
                <RotateCcw className="w-3 h-3 text-sky-400" />
                <span>Reset Demo</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="px-2 py-1 text-slate-400 hover:text-white text-[10px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold shadow-sm"
                >
                  Confirm Reset
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const SimulatedActionBadge: React.FC<{
  type: 'PAYMENT' | 'EMAIL' | 'GITHUB' | 'CUSTOMER_SYSTEM' | 'WORKFLOW';
  className?: string;
}> = ({ type, className = '' }) => {
  const configs = {
    PAYMENT: {
      label: 'SIMULATED PAYMENT',
      style: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
    },
    EMAIL: {
      label: 'SIMULATED EMAIL',
      style: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
    },
    GITHUB: {
      label: 'SIMULATED GITHUB ACTION',
      style: 'bg-sky-950/80 text-sky-300 border-sky-800/60',
    },
    CUSTOMER_SYSTEM: {
      label: 'SIMULATED CUSTOMER SYSTEM',
      style: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60',
    },
    WORKFLOW: {
      label: 'SIMULATED WORKFLOW',
      style: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
    },
  };

  const config = configs[type];

  return (
    <span
      className={`inline-flex items-center text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border ${config.style} ${className}`}
    >
      {config.label}
    </span>
  );
};
