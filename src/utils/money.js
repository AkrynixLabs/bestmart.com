// Cedi amounts: whole numbers stay whole (₵65), anything else shows at most
// two decimals — avoids float noise like ₵0.30000000000000004.
export function formatCedis(amount) {
  const value = Number(amount) || 0
  return `₵${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
