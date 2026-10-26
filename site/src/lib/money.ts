// Why: a cost is shown the same way everywhere, on a post, in the studio's lists and on a live run, and the
// live parts run in the browser. This is the one formatter, on its own so a browser island can use it without
// bringing the ledger's code along.

export interface Currency {
  show: 'GBP' | 'USD';
  /** Units of the shown currency to one US dollar. */
  perUsd: number;
}

/**
 * A cost recorded in US dollars, as a reader reads it in the site's currency: pence or cents below one unit
 * ("3.7p", "4.9¢"), pounds or dollars above ("£1.20").
 */
export function moneyOf(usd: number, currency: Currency = { show: 'USD', perUsd: 1 }): string {
  const amount = usd * currency.perUsd;
  const [major, minor] = currency.show === 'GBP' ? ['£', 'p'] : ['$', '¢'];
  if (amount < 1) {
    const small = amount * 100;
    // "9p", not "9.0p"; a tenth is shown only when it says something.
    const shown =
      small < 0.1 && small > 0 ? '<0.1' : small.toFixed(small < 10 ? 1 : 0).replace(/\.0$/, '');
    return `${shown}${minor}`;
  }
  return `${major}${amount.toFixed(2)}`;
}
