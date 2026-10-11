// Session context sederhana: siapa yang login sekarang + role-nya.
// Dipakai untuk munculkan/sembunyikan tab Approval (khusus mss/hr).

import { setSessionExpiredHandler } from "./api/http";
import React, { useEffect, createContext, useContext, useState } from "react";
import { Employee } from "./types";
import { hrisApi } from "./api";
import { useBahasa } from "@/i18n";
import { ambilTokenPush } from "./push";

interface SessionContextValue {
  employee: Employee | null;
  setEmployee: (employee: Employee | null) => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    setSessionExpiredHandler(() => setEmployee(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  const { setBahasa } = useBahasa();
  const employeeId = employee?.id;

  // Bahasa mengikuti akun ERPNext; gagal membaca = pakai pilihan lokal.
  useEffect(() => {
    if (!employeeId) return;
    hrisApi
      .getLanguage()
      .then((b) => b && setBahasa(b))
      .catch(() => {});
  }, [employeeId, setBahasa]);

  // Daftarkan perangkat untuk push; tanpa izin atau di simulator, dilewati.
  useEffect(() => {
    if (!employeeId) return;
    ambilTokenPush()
      .then((t) => t && hrisApi.registerPushToken(t))
      .catch(() => {});
  }, [employeeId]);

  return (
    <SessionContext.Provider value={{ employee, setEmployee }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
