/**
 * Rent & Expense Splitter Utility
 * CTE308 Project II Mathematical Computation Engine
 *
 * Implements exact multi-occupant utility division:
 * Per Person Payment = (Base Rent + Electricity + Water + WiFi + Maintenance) / Total Roommates
 */

import { ExpenseSplitState } from '@/types/listing';

export interface SplitterResult {
  totalBill: number;
  perPersonShare: number;
  remainderCents: number;
  itemizedBreakdown: {
    baseRent: number;
    electricity: number;
    water: number;
    wifi: number;
    maintenance: number;
  };
  individualBreakdowns: {
    occupantName: string;
    shareAmount: number;
  }[];
}

/**
 * Calculates itemized and per-person cost share among roommates.
 *
 * Mathematical Logic:
 * 1. Sum up all individual utility components:
 *    Total = Base Rent + Electricity + Water + WiFi + Maintenance
 * 2. Validate roommate count (guarantee minimum 1 occupant to avoid division by zero).
 * 3. Divide total by roommate count:
 *    PerPerson = Total / TotalRoommates
 * 4. Round to nearest integer (or two decimals) for Bhutanese Ngultrum (Nu.).
 *
 * @param state ExpenseSplitState containing costs and occupant details
 * @returns SplitterResult with full itemized and individual breakdown
 */
export function calculateExpenseSplit(state: ExpenseSplitState): SplitterResult {
  console.log('[Dwello-Splitter Debug]: Initiating calculation with payload:', state);

  // Guard against non-numeric or negative values
  const rent = Math.max(0, Number(state.baseRent) || 0);
  const electricity = Math.max(0, Number(state.electricity) || 0);
  const water = Math.max(0, Number(state.water) || 0);
  const wifi = Math.max(0, Number(state.wifi) || 0);
  const maintenance = Math.max(0, Number(state.maintenance) || 0);

  // Guarantee minimum 1 occupant
  const roommates = Math.max(1, Math.floor(Number(state.roommateCount) || 1));

  // Step 1: Calculate aggregate sum
  const totalBill = rent + electricity + water + wifi + maintenance;

  // Step 2: Compute per-person payment
  const exactPerPerson = totalBill / roommates;
  // Round to nearest whole Ngultrum for clean local payment requests
  const perPersonShare = Math.round(exactPerPerson);
  const remainderCents = Number((totalBill - perPersonShare * roommates).toFixed(2));

  console.log(`[Dwello-Splitter Debug]: Computed Total = Nu. ${totalBill}, Per Person = Nu. ${perPersonShare} (${roommates} roommates)`);

  // Step 3: Map individual breakdown for named occupants if provided
  const occupants = state.occupantNames && state.occupantNames.length > 0
    ? state.occupantNames
    : Array.from({ length: roommates }, (_, i) => `Roommate ${i + 1}`);

  const individualBreakdowns = occupants.slice(0, roommates).map((name) => ({
    occupantName: name,
    shareAmount: perPersonShare,
  }));

  return {
    totalBill,
    perPersonShare,
    remainderCents,
    itemizedBreakdown: {
      baseRent: rent,
      electricity,
      water,
      wifi,
      maintenance,
    },
    individualBreakdowns,
  };
}

/**
 * Formats a number as Bhutanese Ngultrum (Nu. 13,500)
 *
 * @param amount Number
 * @returns Formatted currency string
 */
export function formatNu(amount: number): string {
  return `Nu. ${Math.round(amount).toLocaleString('en-US')}`;
}

/**
 * Constructs a customized WhatsApp notification message for a specific occupant.
 *
 * @param result SplitterResult
 * @param occupantName Name of the occupant
 * @param occupantIndex 1-based index (e.g. 1 of 3)
 * @param totalOccupants Total number of occupants
 * @returns Pre-formatted WhatsApp text string
 */
export function generateWhatsAppSplitMessage(
  result: SplitterResult,
  occupantName: string = 'Flatmate',
  occupantIndex: number = 1,
  totalOccupants: number = 1
): string {
  console.log(`[Dwello-Splitter Debug]: Generating WhatsApp message for ${occupantName}`);

  const { totalBill, perPersonShare, itemizedBreakdown } = result;

  return (
    `🏠 *DWELLO Rent & Expense Breakdown*\n` +
    `Hello ${occupantName}!\n` +
    `Here is the itemized monthly utility and rent share:\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Monthly Base Rent: ${formatNu(itemizedBreakdown.baseRent)}\n` +
    `• Electricity: ${formatNu(itemizedBreakdown.electricity)}\n` +
    `• Water: ${formatNu(itemizedBreakdown.water)}\n` +
    `• WiFi / Internet: ${formatNu(itemizedBreakdown.wifi)}\n` +
    `• Maintenance: ${formatNu(itemizedBreakdown.maintenance)}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `*Total Bill:* ${formatNu(totalBill)}\n` +
    `*Total Occupants:* ${totalOccupants} people\n` +
    `👉 *Your Share (${occupantIndex}/${totalOccupants}): ${formatNu(perPersonShare)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Please transfer via mBOB / BNBL / BDBL to the primary tenant at your earliest convenience. Thank you!`
  );
}

