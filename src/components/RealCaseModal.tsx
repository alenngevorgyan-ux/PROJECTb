/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useWorld } from '../context/WorldContext';
import {
  FileText,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Mail,
  X,
  Sparkles,
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';

export const RealCaseModal: React.FC = () => {
  const {
    showRealCaseModal,
    setShowRealCaseModal,
    activeCase,
    refreshActiveCase,
    gmailAuth,
    setShowGmailConnectModal,
    addRealityEvent,
    setCharacters,
    animateAgentWalk,
    setActiveDialogue,
  } = useWorld();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [securityAck, setSecurityAck] = useState(false);

  if (!showRealCaseModal || !activeCase) return null;

  const handleSyncReplies = async () => {
    setError(null);
    setSyncStatus('Checking Gmail thread for replies...');

    if (!gmailAuth.isConnected || !gmailAuth.accessToken) {
      setError('Gmail is not connected. Connect your Google account first.');
      setShowGmailConnectModal(true);
      return;
    }

    setIsSyncing(true);

    try {
      const result = await ApiClient.syncReplies(activeCase.id, gmailAuth.accessToken);

      refreshActiveCase();

      if (result.newRepliesCount > 0) {
        setSyncStatus(`Retrieved ${result.newRepliesCount} new supplier reply!`);

        const extracted = result.case.extractedState;

        // Add real reality events
        addRealityEvent({
          agentId: 'acme',
          agentName: 'Acme Manufacturing (Real Reply)',
          worldAction: `REAL GMAIL REPLY: Supplier reply received from ${result.case.contact.email}`,
          businessEvent: `Thread synchronized. Delay: ${extracted?.delayReason || 'Customs hold'}. ETA: ${extracted?.confirmedEta || 'Confirmed'}. Credit: ${extracted?.creditOffer ? `$${extracted.creditOffer.amount}` : 'None'}`,
          category: 'SUPPLY',
          isReal: true,
        });

        // Maya physical return animation to Founder Office!
        setCharacters((prev) =>
          prev.map((c) =>
            c.id === 'maya'
              ? {
                  ...c,
                  status: 'WALKING',
                  statusText: 'Walking back to Founder Office with real reply...',
                }
              : c
          )
        );

        setShowRealCaseModal(false);

        animateAgentWalk(
          'maya',
          [
            { x: 4, y: 5 },
            { x: 4, y: 4 },
            { x: 4, y: 3 },
          ],
          () => {
            setCharacters((prev) =>
              prev.map((c) =>
                c.id === 'maya'
                  ? {
                      ...c,
                      status: 'TALKING',
                      statusText: 'Briefing Founder on real supplier reply',
                      facing: 'left',
                    }
                  : c
              )
            );

            // Report the real extracted result
            const reason = extracted?.delayReason || 'Customs inspection';
            const eta = extracted?.confirmedEta || 'Friday';
            const credit = extracted?.creditOffer?.amount || 400;

            setActiveDialogue({
              characterId: 'maya',
              stage: 'MAYA_REAL_REPORT',
              speaker: 'Maya',
              speakerRole: 'AI Procurement Lead',
              avatarColor: '#10b981',
              message: `Acme replied via Gmail.\n\nDelay reason: ${reason}\nNew ETA: ${eta}\nThey offered: $${credit.toFixed(2)} credit.\n\nWhat do you want to do?`,
              options: [
                {
                  label: `ACCEPT $${credit.toFixed(2)} CREDIT`,
                  actionId: 'MAYA_REAL_ACCEPT_CREDIT',
                  primary: true,
                  variant: 'success',
                },
                {
                  label: 'VIEW FULL GMAIL CASE & THREAD',
                  actionId: 'MAYA_VIEW_REAL_CASE',
                },
                {
                  label: 'DISMISS',
                  actionId: 'DISMISS_DIALOGUE',
                },
              ],
            });
          }
        );
      } else {
        setSyncStatus('No new replies in Gmail thread yet. Awaiting response from supplier.');
      }
    } catch (err: any) {
      setError(`Failed to sync replies: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAcceptCredit = async () => {
    try {
      const creditAmt = activeCase.extractedState?.creditOffer?.amount || 400.0;
      await ApiClient.resolveCase(
        activeCase.id,
        {
          acceptedCredit: creditAmt,
          notes: 'Founder accepted supplier delay credit via Real Supplier Mode.',
          securityReviewAcknowledged: activeCase.status === 'SECURITY_REVIEW' ? securityAck : undefined,
        },
        gmailAuth.accessToken || ''
      );

      addRealityEvent({
        agentId: 'founder',
        agentName: 'Alex Founder',
        worldAction: `Founder accepted $${creditAmt.toFixed(2)} supplier credit on Case ${activeCase.id}`,
        businessEvent: `Applied $${creditAmt.toFixed(2)} credit to supplier balance. Case resolved.`,
        category: 'FINANCE',
        isReal: true,
      });

      refreshActiveCase();
    } catch (err: any) {
      setError(`Failed to accept credit: ${err.message}`);
    }
  };

  const extracted = activeCase.extractedState;
  const hasSecurityRisk = extracted?.securityFlags && extracted.securityFlags.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Case #{activeCase.poNumber ? `PO-${activeCase.poNumber}` : activeCase.id}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800">
                  {activeCase.status}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  REAL MODE
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Supplier Exception · Acme Manufacturing · Rail: Gmail API
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowRealCaseModal(false)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Bank Fraud / Security Flag Warning Banner */}
          {activeCase.needsSenderReview && (
            <div className="p-3 bg-amber-950/30 border border-amber-700/60 rounded-lg text-amber-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span className="text-[11px] leading-relaxed">
                A reply arrived from an address that does not match this Case's known supplier
                contact. It has been recorded below but was NOT used to update extracted facts.
                Please review it manually before trusting its content.
              </span>
            </div>
          )}

          {hasSecurityRisk && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-600 rounded-lg text-rose-200 space-y-2">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <span>CASE SECURITY FLAG: Financial Instruction Detected</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                The supplier message contains banking details or payment instructions. Per strict security policy, AI is prohibited from acting on financial instructions autonomously. Independent human verification is required.
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-rose-300 font-mono">
                {extracted.securityFlags?.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
              {activeCase.status === 'SECURITY_REVIEW' && (
                <label className="flex items-start gap-2 pt-1 text-[11px] text-rose-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={securityAck}
                    onChange={(e) => setSecurityAck(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I have independently verified this financial instruction outside of this email
                    thread and confirm no automated payment action will occur.
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Sync bar */}
          <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <div>
              <div className="text-xs font-semibold text-white">Gmail Thread Synchronization</div>
              <div className="text-[11px] text-slate-400">
                {syncStatus ||
                  (activeCase.status === 'WAITING_REPLY'
                    ? 'Awaiting reply from supplier. Click to query Gmail thread.'
                    : 'Case state synchronized with Google Workspace.')}
              </div>
            </div>
            <button
              onClick={handleSyncReplies}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Replies'}</span>
            </button>
          </div>

          {/* Structured Gemini Extraction Card */}
          {extracted && (
            <div className="p-4 bg-slate-950/80 rounded-lg border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>Extracted Business Facts (Gemini AI)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Confirmed ETA</div>
                  <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                    {extracted.confirmedEta || 'Pending'}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Delay Reason</div>
                  <div className="text-xs font-semibold text-amber-300 mt-0.5">
                    {extracted.delayReason || 'Not specified'}
                  </div>
                </div>

                {extracted.creditOffer && (
                  <div className="p-2.5 bg-slate-900/80 rounded border border-slate-800 md:col-span-2 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-mono">Credit Concession</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">
                        ${extracted.creditOffer.amount.toFixed(2)} {extracted.creditOffer.currency}
                      </div>
                    </div>
                    {activeCase.status !== 'RESOLVED' && (
                      <button
                        onClick={handleAcceptCredit}
                        disabled={activeCase.status === 'SECURITY_REVIEW' && !securityAck}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs font-semibold transition-colors"
                        title={
                          activeCase.status === 'SECURITY_REVIEW' && !securityAck
                            ? 'Acknowledge the security review above first'
                            : undefined
                        }
                      >
                        Accept Credit
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Messages list */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Communication History ({activeCase.messages.length})
            </div>
            {activeCase.messages.length === 0 ? (
              <div className="p-4 bg-slate-950/40 rounded-lg border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                No outbound or inbound messages recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {activeCase.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3.5 rounded-lg border ${
                      msg.senderVerified === false
                        ? 'bg-rose-950/20 border-rose-700/50'
                        : msg.role === 'COUNTERPARTY'
                        ? 'bg-amber-950/20 border-amber-800/40'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{msg.authorName}</span>
                        <span className="text-[10px] font-mono text-slate-500">&lt;{msg.email}&gt;</span>
                        {msg.senderVerified === false && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
                            UNVERIFIED SENDER
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">
                      {msg.body}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Connected: <span className="font-mono text-slate-300">{gmailAuth.email || 'None'}</span>
          </div>
          <button
            onClick={() => setShowRealCaseModal(false)}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
