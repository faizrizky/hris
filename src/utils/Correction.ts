// Kontrak satu tempat: form yang menulis, riwayat yang membaca.
// Em dash dipilih sebagai pemisah karena hampir mustahil diketik user
// di dalam penjelasan, jadi pisahAlasan() tidak akan salah potong.
const PEMISAH = " — ";

export function gabungAlasan(jenis: string, catatan: string) {
  return `${jenis}${PEMISAH}${catatan.trim()}`;
}

export function pisahAlasan(reason: string) {
  const i = reason.indexOf(PEMISAH);
  if (i === -1) return { jenis: reason, catatan: "" };
  return {
    jenis: reason.slice(0, i),
    catatan: reason.slice(i + PEMISAH.length),
  };
}
