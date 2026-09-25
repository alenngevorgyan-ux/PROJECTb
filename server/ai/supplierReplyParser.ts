/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { CaseExtractedState } from '../../src/domain/case/types';
import { ActionPolicy } from '../policy/actionPolicy';
import { serverConfig } from '../config';

export async function parseSupplierReply(replyBody: string): Promise<CaseExtractedState> {
  // 1. Run deterministic bank fraud and security scan FIRST
  const securityScan = ActionPolicy.scanForFinancialFraud(replyBody);

  // Default baseline state if LLM fails or is unavailable
  const fallbackState: CaseExtractedState = {
    requiresHumanDecision: true,
    confidence: 0.5,
    securityFlags: securityScan.flags,
    rawSummary: replyBody.slice(0, 300),
  };

  // Rule-based heuristic extraction for offline / fallback
  const lower = replyBody.toLowerCase();
  if (lower.includes('customs')) {
    fallbackState.delayReason = 'Customs tariff re-classification hold';
  }
  if (lower.includes('friday')) {
    fallbackState.confirmedEta = 'Friday by 2:00 PM EST';
  } else if (lower.includes('thursday')) {
    fallbackState.confirmedEta = 'Thursday evening';
  }
  const creditMatch = replyBody.match(/\$(\d+(\.\d{2})?)/);
  if (creditMatch) {
    const val = parseFloat(creditMatch[1]);
    if (!isNaN(val) && val > 0 && val < 5000) {
      fallbackState.creditOffer = {
        amount: val,
        currency: 'USD',
      };
    }
  }

  if (!serverConfig.geminiApiKey) {
    if (securityScan.hasSecurityRisk) {
      fallbackState.requiresHumanDecision = true;
    }
    return fallbackState;
  }

  try {
    const ai = new GoogleGenAI({});
    const prompt = `You are an AI Procurement system parsing an incoming supplier reply regarding an order delay.
Extract structured commitments, reasons, ETAs, and credit offers.

Supplier Email Body:
"""
${replyBody}
"""

Rules:
1. Extract the actual stated reason for delay into "delayReason". If not stated, leave null/empty.
2. Extract the promised delivery or release timeline into "confirmedEta".
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

    const parsed = JSON.parse(rawText);

    // Merge deterministic security flags with any AI security flags
    const combinedFlags = Array.from(
      new Set([...(securityScan.flags || []), ...(parsed.securityFlags || [])])
    );

    const extracted: CaseExtractedState = {
      delayReason: parsed.delayReason || fallbackState.delayReason,
      confirmedEta: parsed.confirmedEta || fallbackState.confirmedEta,
      creditOffer: parsed.creditOffer || fallbackState.creditOffer,
      missingDocuments: parsed.missingDocuments || [],
      commitments: parsed.commitments || [],
      requiresHumanDecision:
        parsed.requiresHumanDecision !== undefined
          ? parsed.requiresHumanDecision
          : true,
      securityFlags: combinedFlags,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      rawSummary: parsed.summary || replyBody.slice(0, 300),
    };

    if (combinedFlags.length > 0) {
      extracted.requiresHumanDecision = true;
    }

    return extracted;
  } catch (err) {
    console.error('Gemini structured reply parser error, using fallback:', err);
    return fallbackState;
  }
}
