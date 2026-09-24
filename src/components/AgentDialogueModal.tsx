/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useWorld } from '../context/WorldContext';
import { Bot, User, Send, CheckCircle2, AlertTriangle, ArrowRight, X } from 'lucide-react';

export const AgentDialogueModal: React.FC = () => {
  const { activeDialogue, setActiveDialogue, handleDialogueOption } = useWorld();
  const [customInput, setCustomInput] = useState('');

  if (!activeDialogue) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    const lower = customInput.toLowerCase();
    // Intelligent matching against core workflows
    if (activeDialogue.characterId === 'vitek') {
      if (lower.includes('onboarding') || lower.includes('fix') || lower.includes('bug')) {
        handleDialogueOption('VITEK_REQ_ONBOARDING');
      } else if (lower.includes('pr') || lower.includes('pull request')) {
        handleDialogueOption('VIEW_PR_184');
      } else {
        handleDialogueOption('VITEK_REQ_ONBOARDING');
      }
    } else if (activeDialogue.characterId === 'maya') {
      if (lower.includes('acme') || lower.includes('shipment') || lower.includes('511')) {
        handleDialogueOption('MAYA_ASK_ACME_SHIPMENT');
      } else if (lower.includes('credit') || lower.includes('accept')) {
        handleDialogueOption('MAYA_ACCEPT_CREDIT');
      } else {
        handleDialogueOption('MAYA_ASK_ACME_SHIPMENT');
      }
    } else if (activeDialogue.characterId === 'cloudworks-agent') {
      if (lower.includes('pro') || lower.includes('subscription') || lower.includes('renew')) {
        handleDialogueOption('CW_ISSUE_PRO_ACCESS');
      } else if (lower.includes('allow') || lower.includes('yes')) {
        handleDialogueOption('CW_ALLOW_ONCE');
      } else if (lower.includes('fix')) {
        handleDialogueOption('CW_FIX_IT');
      } else {
        handleDialogueOption('CW_ISSUE_PRO_ACCESS');
      }
    } else if (activeDialogue.characterId === 'nova') {
      if (lower.includes('alex') || lower.includes('onboarding') || lower.includes('work')) {
        handleDialogueOption('NOVA_WORK_WITH_ALEX');
      } else {
        handleDialogueOption('NOVA_WORK_WITH_ALEX');
      }
    }
    setCustomInput('');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm"
              style={{ backgroundColor: activeDialogue.avatarColor }}
            >
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white">{activeDialogue.speaker}</span>
                <span className="text-[10px] font-mono text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800/40">
                  AI AGENT
                </span>
              </div>
              <div className="text-xs text-slate-400">{activeDialogue.speakerRole}</div>
            </div>
          </div>

          <button
            onClick={() => setActiveDialogue(null)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Body */}
        <div className="p-5 flex-1 bg-slate-900/90 text-sm text-slate-200 space-y-4">
          <div className="p-3.5 bg-slate-950/60 rounded-lg border border-slate-800 leading-relaxed whitespace-pre-line font-sans">
            {activeDialogue.message}
          </div>

          {/* Action Options */}
          {activeDialogue.options && activeDialogue.options.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Suggested Actions:
              </div>
              <div className="flex flex-col gap-1.5">
                {activeDialogue.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleDialogueOption(opt.actionId)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium text-left transition-all ${
                      opt.variant === 'success'
                        ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-sm'
                        : opt.variant === 'danger'
                        ? 'bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60'
                        : opt.primary
                        ? 'bg-sky-600/90 hover:bg-sky-500 text-white shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-70 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input Bar for natural instruction */}
        <form onSubmit={handleCustomSubmit} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder={`Type a directive for ${activeDialogue.speaker}...`}
            className="flex-1 bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 px-3 py-2 rounded-lg focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs transition-colors shrink-0"
            title="Send directive"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
