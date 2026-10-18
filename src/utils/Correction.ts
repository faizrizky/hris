// Kontrak satu tempat: form yang menulis, riwayat yang membaca.
// Em dash dipilih sebagai pemisah karena hampir mustahil diketik user
// di dalam penjelasan, jadi pisahAlasan() tidak akan salah potong.
const SEPARATOR = " — ";

export function joinReason(kind: string, note: string) {
  return `${kind}${SEPARATOR}${note.trim()}`;
}

export function splitReason(reason: string) {
  const i = reason.indexOf(SEPARATOR);
  if (i === -1) return { kind: reason, note: "" };
  return {
    kind: reason.slice(0, i),
    note: reason.slice(i + SEPARATOR.length),
  };
}
