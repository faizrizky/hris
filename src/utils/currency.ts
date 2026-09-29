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

/** 4.2 -> "4,2" · 5 -> "5,0" — desimal gaya Indonesia */
export function desimal(n: number, digit = 1) {
  return n.toFixed(digit).replace(".", ",");
}
