/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Deterministic security policy engine.
 * The LLM is NEVER an authorization authority.
 */
export class ActionPolicy {
  public static canSendEmail(isApprovedByHuman: boolean): { allowed: boolean; reason?: string } {
    if (!isApprovedByHuman) {
      return {
        allowed: false,
        reason: 'Human approval is strictly required before sending any outbound email.',
      };
    }
    return { allowed: true };
  }

  public static canAcceptCredit(isApprovedByHuman: boolean): { allowed: boolean; reason?: string } {
    if (!isApprovedByHuman) {
      return {
        allowed: false,
        reason: 'Human approval is strictly required before accepting commercial credits.',
      };
    }
    return { allowed: true };
  }

  public static checkProhibitedAction(action: string): { allowed: boolean; reason: string } {
    const prohibitedActions = [
      'CHANGE_PO_QUANTITY',
      'CHANGE_PRICE',
      'ACCEPT_CONTRACTUAL_TERMS',
      'PAY_MONEY',
      'CHANGE_BANK_DETAILS',
    ];

    if (prohibitedActions.includes(action)) {
      return {
        allowed: false,
        reason: `Action "${action}" is strictly prohibited in Real Supplier Mode v0.`,
      };
    }
    return { allowed: true, reason: '' };
  }

  /**
   * Scans text for wire instructions, bank account changes, crypto, or payment requests.
   * If detected, raises a security flag requiring independent verification.
   */
  public static scanForFinancialFraud(text: string): { hasSecurityRisk: boolean; flags: string[] } {
    if (!text) {
      return { hasSecurityRisk: false, flags: [] };
    }

    const lower = text.toLowerCase();
    const flags: string[] = [];

    const fraudTriggers = [
      {
        pattern: /bank\s+(account|detail|routing|info|transfer)/i,
        flag: 'Supplier message mentions bank account details or routing numbers.',
      },
      {
        pattern: /wire\s+(instruction|transfer|detail)/i,
        flag: 'Supplier message requests wire transfer instructions.',
      },
      {
        pattern: /iban\s*[:#\s]?\s*[a-z0-9]{15,34}/i,
        flag: 'Supplier message contains IBAN banking pattern.',
      },
      {
        pattern: /swift\s*[:#\s]?\s*[a-z0-9]{8,11}/i,
        flag: 'Supplier message contains SWIFT/BIC banking pattern.',
      },
      {
        pattern: /new\s+(bank\s+account|payment\s+address|routing\s+number)/i,
        flag: 'Supplier claims updated payment destination or new bank account.',
      },
      {
        pattern: /(crypto|bitcoin|usdt|ethereum|wallet\s+address)/i,
        flag: 'Supplier requests cryptocurrency or alternative asset payment.',
      },
      {
        pattern: /pay\s+(directly\s+to|to\s+new|immediately\s+via\s+wire)/i,
        flag: 'Supplier instructs immediate direct wire or urgent payment diversion.',
      },
    ];

    for (const item of fraudTriggers) {
      if (item.pattern.test(lower)) {
        flags.push(item.flag);
      }
    }

    if (flags.length > 0) {
      flags.unshift('Financial instruction requires independent human verification.');
    }

    return {
      hasSecurityRisk: flags.length > 0,
      flags,
    };
  }
}
