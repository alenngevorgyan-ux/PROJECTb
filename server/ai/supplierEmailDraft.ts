/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { serverConfig } from '../config';

export async function generateSupplierDraft(params: {
  poNumber?: string;
  objective?: string;
  counterpartyName?: string;
  contactName?: string;
  contactEmail: string;
  context?: string;
}): Promise<{ subject: string; body: string }> {
  const po = params.poNumber || '511';
  const vendor = params.counterpartyName || 'Acme Manufacturing';
  const contact = params.contactName || 'Fabrication Support';

  const objectiveLine = params.objective
    ? params.objective
    : `Check the current status of PO #${po} and obtain a confirmed delivery ETA.`;
  const contextLine = params.context ? `\n\n${params.context}` : '';

  const defaultDraft = {
    subject: `PO #${po} — Status & Confirmed ETA Requested`,
    body: `Hi ${contact},

${objectiveLine}${contextLine}

Could you please confirm the current status of this order, the reason for any delay, and a confirmed delivery date?

Best regards,
Maya
AI Procurement Lead · My Company`,
  };

  if (!serverConfig.geminiApiKey) {
    return defaultDraft;
  }

  try {
    const ai = new GoogleGenAI({});
    const prompt = `You are Maya, an AI Procurement Lead for a modern hardware company.
Your job is to draft a concise, professional, polite supplier email inquiring about an order delay.

Details:
- Purchase Order: PO #${po}
- Counterparty: ${vendor}
- Supplier Contact: ${contact} (${params.contactEmail})
- Objective: ${params.objective || 'Check the current status of this order and obtain a confirmed delivery ETA.'}
- Context: ${params.context || '(no additional context provided)'}

Rules:
1. Do NOT invent logistics specifics — no customs holds, freight tracking numbers, chassis/parts
   details, assembly facilities, or causes of delay — unless they literally appear in Details or
   Context above. If no cause is known, simply ask for one; do not assume or imply a cause.
2. Ask for the reason for delay and a confirmed delivery ETA.
3. Keep the tone professional, firm, yet collaborative.
4. Return ONLY a valid JSON object with the format:
{
  "subject": "...",
  "body": "..."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text?.trim() || '';
    if (rawText) {
      const parsed = JSON.parse(rawText);
      if (parsed.subject && parsed.body) {
        return {
          subject: parsed.subject,
          body: parsed.body,
        };
      }
    }
    return defaultDraft;
  } catch (err) {
    console.error('Error generating email draft with Gemini, using fallback draft:', err);
    return defaultDraft;
  }
}
