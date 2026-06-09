import { simplifyDebts } from '../debts';
import type { NetBalance } from '../../types/models';

/** Build a NetBalance quickly (positive = owed to them, negative = they owe). */
const bal = (id: string, amount: number, name: string | null = id): NetBalance => ({
  user_id: id,
  full_name: name,
  amount,
});

/** Total money each person sends out, keyed by debtor id. */
const outgoing = (debts: ReturnType<typeof simplifyDebts>) =>
  debts.reduce<Record<string, number>>((acc, d) => {
    acc[d.from_id] = (acc[d.from_id] ?? 0) + d.amount;
    return acc;
  }, {});

/** Total money each person receives, keyed by creditor id. */
const incoming = (debts: ReturnType<typeof simplifyDebts>) =>
  debts.reduce<Record<string, number>>((acc, d) => {
    acc[d.to_id] = (acc[d.to_id] ?? 0) + d.amount;
    return acc;
  }, {});

describe('simplifyDebts', () => {
  describe('edge cases', () => {
    it('returns no transfers for an empty balance list', () => {
      expect(simplifyDebts([])).toEqual([]);
    });

    it('returns no transfers when everyone is already settled (all zero)', () => {
      expect(simplifyDebts([bal('A', 0), bal('B', 0), bal('C', 0)])).toEqual([]);
    });

    it('returns no transfers when there are only creditors and no debtors', () => {
      // Degenerate/inconsistent input: nothing to pay from, so nothing is emitted.
      expect(simplifyDebts([bal('A', 100), bal('B', 50)])).toEqual([]);
    });
  });

  describe('basic settlements', () => {
    it('settles a simple two-person debt', () => {
      const result = simplifyDebts([bal('A', -100), bal('B', 100)]);
      expect(result).toEqual([
        { from_id: 'A', from_name: 'A', to_id: 'B', to_name: 'B', amount: 100 },
      ]);
    });

    it('splits one debtor across multiple creditors (largest creditor first)', () => {
      // C owes 100; it is owed to A (60) and B (40).
      const result = simplifyDebts([bal('A', 60), bal('B', 40), bal('C', -100)]);
      expect(result).toEqual([
        { from_id: 'C', from_name: 'C', to_id: 'A', to_name: 'A', amount: 60 },
        { from_id: 'C', from_name: 'C', to_id: 'B', to_name: 'B', amount: 40 },
      ]);
    });

    it('collects from multiple debtors into a single creditor (largest debtor first)', () => {
      // C is owed 100, paid by B (70) then A (30).
      const result = simplifyDebts([bal('A', -30), bal('B', -70), bal('C', 100)]);
      expect(result).toEqual([
        { from_id: 'B', from_name: 'B', to_id: 'C', to_name: 'C', amount: 70 },
        { from_id: 'A', from_name: 'A', to_id: 'C', to_name: 'C', amount: 30 },
      ]);
    });
  });

  describe('chain simplification (the core feature)', () => {
    it('avoids pass-through transfers: A owes, B owes, C and D are owed', () => {
      // A:-100, B:-50, C:+100, D:+50  ->  A pays C 100, B pays D 50 (2 transfers, no middlemen).
      const result = simplifyDebts([bal('A', -100), bal('B', -50), bal('C', 100), bal('D', 50)]);
      expect(result).toEqual([
        { from_id: 'A', from_name: 'A', to_id: 'C', to_name: 'C', amount: 100 },
        { from_id: 'B', from_name: 'B', to_id: 'D', to_name: 'D', amount: 50 },
      ]);
    });

    it('produces at most (participants - 1) transfers', () => {
      const balances = [bal('A', -90), bal('B', -60), bal('C', -30), bal('D', 100), bal('E', 80)];
      const result = simplifyDebts(balances);
      expect(result.length).toBeLessThanOrEqual(balances.length - 1);
    });
  });

  describe('conservation invariants', () => {
    const scenarios: { name: string; balances: NetBalance[] }[] = [
      { name: 'two-person', balances: [bal('A', -100), bal('B', 100)] },
      {
        name: 'fan-out',
        balances: [bal('A', 60), bal('B', 40), bal('C', -100)],
      },
      {
        name: 'multi-party chain',
        balances: [bal('A', -90), bal('B', -60), bal('C', -30), bal('D', 100), bal('E', 80)],
      },
    ];

    it.each(scenarios)('each debtor pays exactly what they owe ($name)', ({ balances }) => {
      const result = simplifyDebts(balances);
      const out = outgoing(result);
      for (const b of balances) {
        if (b.amount < 0) expect(out[b.user_id] ?? 0).toBe(-b.amount);
      }
    });

    it.each(scenarios)(
      'each creditor receives exactly what they are owed ($name)',
      ({ balances }) => {
        const result = simplifyDebts(balances);
        const inc = incoming(result);
        for (const b of balances) {
          if (b.amount > 0) expect(inc[b.user_id] ?? 0).toBe(b.amount);
        }
      }
    );

    it.each(scenarios)('total paid equals total received ($name)', ({ balances }) => {
      const result = simplifyDebts(balances);
      const totalOut = result.reduce((s, d) => s + d.amount, 0);
      const totalCredit = balances.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0);
      expect(totalOut).toBe(totalCredit);
    });
  });

  describe('output formatting', () => {
    it('rounds every transfer amount to an integer', () => {
      const result = simplifyDebts([bal('A', -33), bal('B', -33), bal('C', -34), bal('D', 100)]);
      for (const d of result) expect(Number.isInteger(d.amount)).toBe(true);
    });

    it('falls back to an empty string when a name is null', () => {
      const result = simplifyDebts([bal('A', -50, null), bal('B', 50, null)]);
      expect(result[0].from_name).toBe('');
      expect(result[0].to_name).toBe('');
    });

    it('does not mutate the input balances', () => {
      const balances = [bal('A', -100), bal('B', 100)];
      const snapshot = JSON.parse(JSON.stringify(balances));
      simplifyDebts(balances);
      expect(balances).toEqual(snapshot);
    });
  });
});
