/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useWorld } from '../context/WorldContext';
import { SimulatedActionBadge } from './DemoModeBadge';
import {
  Palette,
  Sparkles,
  CheckCircle2,
  Sliders,
  Layers,
  Smartphone,
  Eye,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react';

export const DesignReviewModal: React.FC = () => {
  const { showDesignReviewModal, setShowDesignReviewModal, addRealityEvent } = useWorld();
  const [activeTab, setActiveTab] = useState<'PREVIEW' | 'TOKENS' | 'DIFF'>('PREVIEW');
  const [isApproved, setIsApproved] = useState<boolean>(false);

  if (!showDesignReviewModal) return null;

  const handleApprove = () => {
    setIsApproved(true);
    addRealityEvent({
      agentId: 'founder',
      agentName: 'Alex Founder',
      worldAction: 'Founder signed off on Project Apollo Design V2 tokens',
      businessEvent: 'Exported Figma token bundle to Northstar and synced repo styling variables',
      category: 'DESIGN',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setShowDesignReviewModal(false)}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950/80 text-indigo-400 rounded-lg border border-indigo-800/50">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  Project Apollo: Design V2 Review
                </span>
                <SimulatedActionBadge type="WORKFLOW" />
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800/60">
                  NORTHSTAR × MY COMPANY
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Joint Collaboration: Nova (AI Principal Designer) & Alex (Human Lead)
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowDesignReviewModal(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Tabs */}
        <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('PREVIEW')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeTab === 'PREVIEW'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Visual Layout Preview
          </button>
          <button
            onClick={() => setActiveTab('TOKENS')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeTab === 'TOKENS'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Design Tokens (Fluid 8pt)
          </button>
          <button
            onClick={() => setActiveTab('DIFF')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeTab === 'DIFF'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            V1 vs V2 Comparison
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4 text-xs">
          {activeTab === 'PREVIEW' && (
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center py-4 bg-slate-950/80 rounded-xl border border-slate-800">
              {/* Simulated Mobile Device Preview */}
              <div className="w-64 bg-slate-900 border-2 border-slate-700 rounded-3xl p-3.5 shadow-xl space-y-3">
                {/* Mobile Status Bar */}
                <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono px-1">
                  <span>9:41</span>
                  <span>5G · 100%</span>
                </div>

                {/* Onboarding Screen Mockup */}
                <div className="space-y-3 pt-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    BW
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Welcome to Business World</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Connect your team, autonomous agents, and enterprise partners.
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-400">
                      Work Email: alex@mycompany.dev
                    </div>
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-400">
                      Access Passphrase: ••••••••••••
                    </div>
                  </div>

                  <button className="w-full py-2 bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-semibold rounded-lg text-[11px] shadow-md">
                    Complete Verified Onboarding
                  </button>
                </div>
              </div>

              {/* Specification Highlights */}
              <div className="space-y-2 max-w-xs text-slate-300">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Northstar Design System V2</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Nova corrected the viewport breakpoint regression that previously squeezed mobile navigation buttons.
                </p>
                <div className="space-y-1 pt-1 font-mono text-[10px]">
                  <div className="text-emerald-400">✓ WCAG 2.2 AA Contrast: 7.2:1</div>
                  <div className="text-emerald-400">✓ Touch Targets: ≥ 48px standard</div>
                  <div className="text-emerald-400">✓ Preserved auth callback hydration hooks</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'TOKENS' && (
            <div className="space-y-3">
              <div className="text-[11px] font-semibold text-slate-300">
                Shared Cross-Organization Tokens (Northstar Design Sync)
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400">--brand-primary</div>
                  <div className="text-sky-400 font-bold mt-0.5">#0284c7 (Sky 600)</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400">--brand-accent</div>
                  <div className="text-indigo-400 font-bold mt-0.5">#6366f1 (Indigo 500)</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400">--surface-card</div>
                  <div className="text-slate-200 font-bold mt-0.5">#0f172a (Slate 900)</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400">--grid-base</div>
                  <div className="text-emerald-400 font-bold mt-0.5">8px fluid rhythm</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'DIFF' && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-300">Architecture Changes</div>
              <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5 text-[11px] text-slate-300">
                <div className="text-rose-400 font-medium">Design V1 Issues:</div>
                <ul className="list-disc list-inside text-slate-400 pl-1">
                  <li>Fixed 320px container broke layout on modern responsive devices.</li>
                  <li>Inadequate color contrast (3.1:1 on secondary action buttons).</li>
                  <li>Lacked token bindings with Northstar component catalog.</li>
                </ul>

                <div className="text-emerald-400 font-medium pt-2">Design V2 Resolutions:</div>
                <ul className="list-disc list-inside text-slate-400 pl-1">
                  <li>Dynamic flex fluid layout adhering to Northstar mobile grid.</li>
                  <li>7.2:1 contrast ratio passing all accessibility audits.</li>
                  <li>Instant token hot-reloading across partner API rails.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            {isApproved ? 'Approved by Founder Alex' : 'Requires Human Executive Sign-off'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDesignReviewModal(false)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
            >
              Close
            </button>

            {!isApproved ? (
              <button
                onClick={handleApprove}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Approve Design V2</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="px-4 py-1.5 bg-emerald-950 text-emerald-300 rounded text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Tokens Synced to Main</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
