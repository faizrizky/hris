import { useEffect, useState } from "react";
import type { ScreenProps } from "@/navigation/types";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import {
  EditableProfile,
  EmergencyContact,
  FamilyMember,
  PersonalProfile,
} from "@/services/types";
import {
  isValidEmail,
  findShortcomings,
  completenessPercent,
  isValidPhone,
} from "@/utils/ProfileCompleteness";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { goBackAnimated } from "@/navigation/navigationBack";

export function useProfileEdit({
  navigation,
}: Pick<ScreenProps, "navigation">) {
  const t = useT();
  const confirm = useConfirm();
  const { employee } = useSession();
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [draft, setDraft] = useState<EditableProfile | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!employee) return;
    hrisApi
      .getPersonalProfile(employee.id)
      .then((p) => {
        setProfile(p);
        // Draft terpisah dari data tersimpan: perubahan baru berlaku saat disimpan.
        setDraft(p.editable);
      })
      .catch((e) => setLoadError(describeError(e)));
  }, [employee, attempt]);
  const update = (patch: Partial<EditableProfile>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  const percent = draft ? completenessPercent(draft) : 0;
  const shortcomings = draft ? findShortcomings(draft) : [];
  const hasInvalidEmail =
    !!draft?.personalEmail && !isValidEmail(draft.personalEmail);
  const [datePickerTarget, setDatePickerTarget] = useState<number | null>(null);
  const updateMember = (i: number, patch: Partial<FamilyMember>) =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            family: prev.family.map((m, j) =>
              j === i ? { ...m, ...patch } : m,
            ),
          }
        : prev,
    );
  const addMember = () =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            family: [
              ...prev.family,
              {
                name: "",
                relation: "Child",
                birthDate: null,
                dependent: false,
              },
            ],
          }
        : prev,
    );
  const removeMember = (i: number) =>
    setDraft((prev) =>
      prev ? { ...prev, family: prev.family.filter((_, j) => j !== i) } : prev,
    );
  const updateContact = (i: number, patch: Partial<EmergencyContact>) =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            contacts: prev.contacts.map((k, j) =>
              j === i ? { ...k, ...patch } : k,
            ),
          }
        : prev,
    );
  const appendContact = () =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            contacts: [
              ...prev.contacts,
              { name: "", relation: "Other", phone: "" },
            ],
          }
        : prev,
    );
  const removeContact = (i: number) =>
    setDraft((prev) =>
      prev
        ? { ...prev, contacts: prev.contacts.filter((_, j) => j !== i) }
        : prev,
    );
  const isChangeRequest = !!profile && !profile.canEditDirectly;
  const [reason, setReason] = useState("");
  const save = async () => {
    if (!employee || !draft || hasInvalidEmail) return;
    if (isChangeRequest && !reason.trim()) {
      setSaveError(t("pc.alasanWajib"));
      return;
    }
    // Baris yang benar-benar kosong dibuang; yang setengah terisi harus dilengkapi.
    const contact = draft.contacts.filter(
      (k) => k.name.trim() || k.phone.trim(),
    );
    if (contact.some((k) => !k.name.trim() || !isValidPhone(k.phone))) {
      setSaveError(t("pe.kontakTidakLengkap"));
      return;
    }
    if (draft.family.some((m) => !m.name.trim())) {
      setSaveError(t("pe.keluargaTidakLengkap"));
      return;
    }
    setIsSending(true);
    setSaveError(null);
    try {
      const data = { ...draft, contacts: contact };
      if (isChangeRequest) {
        await hrisApi.submitProfileChange(data, reason.trim());
        await confirm({
          title: t("pc.terkirimJudul"),
          message: t("pc.terkirimPesan"),
          tone: "info",
          confirmText: t("umum.mengerti"),
          cancelText: null,
        });
      } else {
        await hrisApi.savePersonalProfile(employee.id, data);
      }
      goBackAnimated(navigation);
    } catch (e) {
      setSaveError(describeError(e));
    } finally {
      setIsSending(false);
    }
  };
  return {
    profile,
    draft,
    isSending,
    loadError,
    setLoadError,
    saveError,
    setAttempt,
    update,
    percent,
    shortcomings,
    hasInvalidEmail,
    datePickerTarget,
    setDatePickerTarget,
    updateMember,
    addMember,
    removeMember,
    updateContact,
    appendContact,
    removeContact,
    isChangeRequest,
    reason,
    setReason,
    save,
  };
}
