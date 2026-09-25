/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { CaseExtractedState } from '../../src/domain/case/types';
import { ActionPolicy } from '../policy/actionPolicy';
import { serverConfig } from '../config';

const KNOWN_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'MXN']);
const DAY_WORDS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Extracts the sentence (or a bounded window of text) around the first
 * match of `keyword`, verbatim from the source. Used by the offline
 * fallback so we surface only what the supplier actually wrote, never an
 * invented specific cause or time.
 */
function extractSentenceContaining(text: string, keyword: string): string | undefined {
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return undefined;
  const sentenceBoundaries = /[.\n!?]/;
  let start = idx;
  while (start > 0 && !sentenceBoundaries.test(text[start - 1])) start--;
  let end = idx;
  while (end < text.length && !sentenceBoundaries.test(text[end])) end++;
  const sentence = text.slice(start, end).trim();
  return sentence.length > 0 ? sentence.slice(0, 160) : undefined;
}

/**
 * Deterministic, offline fallback extraction used when Gemini is
 * unavailable/unconfigured or returns invalid output. This function must
 * NEVER invent specificity (times, causes, documents) that is not
 * literally present in the supplier's text — unknown is always better
 * than invented.
 */
function extractFallbackFacts(replyBody: string): Pick<CaseExtractedState, 'delayReason' | 'confirmedEta' | 'creditOffer'> {
  const lower = replyBody.toLowerCase();
  const facts: Pick<CaseExtractedState, 'delayReason' | 'confirmedEta' | 'creditOffer'> = {};

  if (lower.includes('customs')) {
    facts.delayReason = extractSentenceContaining(replyBody, 'customs');
  }

  let earliestDayIdx = -1;
  let earliestDay: string | undefined;
  for (const day of DAY_WORDS) {
    const idx = lower.indexOf(day);
    if (idx !== -1 && (earliestDayIdx === -1 || idx < earliestDayIdx)) {
      earliestDayIdx = idx;
      earliestDay = day;
    }
  }
  if (earliestDay) {
    facts.confirmedEta = extractSentenceContaining(replyBody, earliestDay);
  }

  const creditMatch = replyBody.match(/\$(\d+(\.\d{2})?)/);
  if (creditMatch) {
    const val = parseFloat(creditMatch[1]);
    if (Number.isFinite(val) && val > 0 && val < 1_000_000) {
      facts.creditOffer = { amount: val, currency: 'USD' };
    }
  }

  return facts;
}

/**
 * Validates and sanitizes raw model output before it is trusted as a
 * Case's extractedState. Gemini output is never trusted blindly: fields
 * with the wrong shape or out-of-range values are dropped (left unknown)
 * rather than coerced into a plausible-looking but invented value.
 */
export function validateExtractedState(
  raw: any,
  securityFlags: string[],
  fallback: Pick<CaseExtractedState, 'delayReason' | 'confirmedEta' | 'creditOffer'>
): CaseExtractedState {
  const safeString = (v: any, maxLen = 500): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, maxLen);
  };

  const safeStringArray = (v: any, maxLen = 500): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const arr = v.filter((x) => typeof x === 'string' && x.trim().length > 0).map((x) => x.slice(0, maxLen));
    return arr.length > 0 ? arr : undefined;
  };

  let creditOffer: CaseExtractedState['creditOffer'] | undefined;
  if (raw && typeof raw === 'object' && raw.creditOffer && typeof raw.creditOffer === 'object') {
    const amount = raw.creditOffer.amount;
    const currency = safeString(raw.creditOffer.currency, 3)?.toUpperCase();
    if (
      typeof amount === 'number' &&
      Number.isFinite(amount) &&
      amount >= 0 &&
      amount < 1_000_000 &&
      currency &&
      KNOWN_CURRENCIES.has(currency)
    ) {
      creditOffer = { amount, currency };
    }
  }

  let confidence = 0.5;
  if (raw && typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)) {
    confidence = Math.max(0, Math.min(1, raw.confidence));
  }

  const modelSecurityFlags = safeStringArray(raw?.securityFlags, 300) || [];
  const combinedFlags = Array.from(new Set([...securityFlags, ...modelSecurityFlags]));

  const requiresHumanDecision =
    typeof raw?.requiresHumanDecision === 'boolean' ? raw.requiresHumanDecision : true;

  return {
    delayReason: safeString(raw?.delayReason, 300) ?? fallback.delayReason,
    confirmedEta: safeString(raw?.confirmedEta, 200) ?? fallback.confirmedEta,
    creditOffer: creditOffer ?? fallback.creditOffer,
    missingDocuments: safeStringArray(raw?.missingDocuments) || [],
    commitments: safeStringArray(raw?.commitments) || [],
    requiresHumanDecision: combinedFlags.length > 0 ? true : requiresHumanDecision,
    securityFlags: combinedFlags,
    confidence,
    rawSummary: safeString(raw?.summary, 400) ?? undefined,
  };
}

export async function parseSupplierReply(replyBody: string): Promise<CaseExtractedState> {
  // 1. Run deterministic bank fraud and security scan FIRST — this never
  // depends on the LLM and always applies regardless of Gemini availability.
  const securityScan = ActionPolicy.scanForFinancialFraud(replyBody);
  const fallbackFacts = extractFallbackFacts(replyBody);

  const fallbackState: CaseExtractedState = {
    ...fallbackFacts,
    requiresHumanDecision: true,
    confidence: 0.5,
    securityFlags: securityScan.flags,
    rawSummary: replyBody.slice(0, 300),
  };

  if (!serverConfig.geminiApiKey) {
    return fallbackState;
  }

  try {
    const ai = new GoogleGenAI({});
    const prompt = `You are an AI Procurement system parsing an incoming supplier reply regarding an order delay.
Extract ONLY facts explicitly stated in the email. Do not infer, estimate, or add specificity that is not
literally present (no invented times, dates, causes, amounts, currencies, documents, or commitments).
If a fact is not stated, leave the corresponding field empty/null — unknown is always preferable to a guess.

Supplier Email Body:
"""
${replyBody}
"""

Rules:
1. Extract the actual stated reason for delay into "delayReason" verbatim or near-verbatim. If not stated, leave null.
2. Extract the promised delivery or release timeline into "confirmedEta" verbatim or near-verbatim. If not stated, leave null.
3. If the supplier offers a discount, credit, or price concession, extract amount and currency into "creditOffer".
4. If the message requests wire transfer, bank changes, new accounts, or payment routing, record in "securityFlags".
5. Set "requiresHumanDecision" to true if there is a credit offer, date change, or security concern.
6. Provide a confidence score between 0.0 and 1.0.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            delayReason: { type: Type.STRING },
            confirmedEta: { type: Type.STRING },
            creditOffer: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                currency: { type: Type.STRING },
              },
            },
            missingDocuments: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            commitments: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            requiresHumanDecision: { type: Type.BOOLEAN },
            securityFlags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            confidence: { type: Type.NUMBER },
            summary: { type: Type.STRING },
          },
          required: ['requiresHumanDecision'],
        },
      },
    });

    const rawText = response.text?.trim() || '';
    if (!rawText) {
      return fallbackState;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Gemini reply parser returned invalid JSON, using fallback:', parseErr);
      return fallbackState;
    }

    return validateExtractedState(parsed, securityScan.flags, fallbackFacts);
  } catch (err) {
    console.error('Gemini structured reply parser error, using strict fallback:', err);
    return fallbackState;
  }
}
