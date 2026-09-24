/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useWorld } from '../context/WorldContext';
import { SimulatedActionBadge } from './DemoModeBadge';
import { GitPullRequest, CheckCircle2, GitCommit, GitBranch, ArrowRight, X } from 'lucide-react';

export const PullRequestModal: React.FC = () => {
  const { showPRModal, setShowPRModal, pullRequests, mergePullRequest } = useWorld();

  if (!showPRModal) return null;

  const pr = pullRequests[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setShowPRModal(false)}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-800/50 mt-0.5">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  PR #{pr.number}: {pr.title}
                </span>
                <SimulatedActionBadge type="GITHUB" />
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                    pr.status === 'MERGED'
                      ? 'bg-purple-950 text-purple-300 border border-purple-800/60'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                  }`}
                >
                  {pr.status === 'MERGED' ? 'MERGED' : 'CHECKS PASSING (42/42 SIMULATED)'}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 font-mono">
                <GitBranch className="w-3.5 h-3.5 text-sky-400" />
                <span>{pr.branch}</span>
                <span>·</span>
                <span>Author: {pr.author}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowPRModal(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4 text-xs">
          {/* Summary Box */}
          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5">
            <div className="font-semibold text-slate-200">Investigation Summary</div>
            <p className="text-slate-300 leading-relaxed">{pr.summary}</p>
            <div className="text-[11px] font-mono text-emerald-400 pt-1">
              ✓ Simulated CI: {pr.testsPassed} of {pr.testsCount} tests passed (100% test coverage)
            </div>
          </div>

          {/* Unified Diff View */}
          <div className="border border-slate-800 rounded-lg overflow-hidden font-mono text-[11px]">
            <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 text-slate-400 flex items-center justify-between">
              <span>src/auth/useSessionState.ts</span>
              <span className="text-slate-500">{pr.diffSummary}</span>
            </div>
            <div className="p-3 bg-slate-950/90 text-slate-300 space-y-1">
              <div className="text-slate-500">// Prevent hydration wipe during email verification redirection</div>
              <div className="text-slate-400"> export function useSessionState() {'{'}</div>
              <div className="text-rose-400 bg-rose-950/30 px-1 py-0.5 rounded">
                - const isVerified = params.get('verified') === 'true';
              </div>
              <div className="text-rose-400 bg-rose-950/30 px-1 py-0.5 rounded">
                - resetLocalSignupState();
              </div>
              <div className="text-emerald-400 bg-emerald-950/30 px-1 py-0.5 rounded">
                + const isVerified = validateEmailVerificationToken(token);
              </div>
              <div className="text-emerald-400 bg-emerald-950/30 px-1 py-0.5 rounded">
                + preserveAuthHydration(isVerified);
              </div>
              <div className="text-slate-400"> {'}'}</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Simulated GitHub / CI workflow synced with Engineering bay
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPRModal(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
            >
              Close
            </button>
            {pr.status !== 'MERGED' ? (
              <button
                onClick={() => {
                  mergePullRequest(pr.id);
                  setShowPRModal(false);
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Simulate PR Merge</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="px-3 py-1.5 bg-purple-950 text-purple-300 rounded text-xs font-semibold">
                ✓ Merged in Demo Repository
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
