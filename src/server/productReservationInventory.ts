type ReservationInventoryBalance = {
  location: { code: string };
  onHandQuantity: number;
  reservedQuantity: number;
};

export function getCentralAvailableQuantity(balances: ReservationInventoryBalance[]): number {
  const available = balances
    .filter(balance => balance.location.code === 'central')
    .reduce((total, balance) => total + balance.onHandQuantity - balance.reservedQuantity, 0);
  return Math.max(0, available);
}
