/** 9263750 -> "9.263.750" */

export function angka(value: number) {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
/** 9263750 -> "Rp 9.263.750" */

export function rupiah(value: number) {
  return `Rp ${angka(value)}`;
}
