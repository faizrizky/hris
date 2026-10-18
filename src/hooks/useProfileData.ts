import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { PersonalProfile, ProfileChange } from "@/services/types";
import {
  findShortcomings,
  completenessPercent,
} from "@/utils/ProfileCompleteness";
import { useProfilePhoto } from "@/hooks/useProfilePhoto";

export function useProfileData() {
  const { employee } = useSession();
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [request, setRequest] = useState<ProfileChange[]>([]);
  const photoUri = useProfilePhoto();
  const [hasSeen, setHasSeen] = useState<boolean | null>(null);
  const load = useCallback(() => {
    if (!employee) return;
    setErrorMessage(null);
    hrisApi
      .getPersonalProfile(employee.id)
      .then((p) => {
        setProfile(p);
        // Riwayat permintaan hanya relevan bagi yang tidak mengubah langsung.
        if (!p.canEditDirectly) {
          hrisApi
            .getMyProfileChanges()
            .then(setRequest)
            .catch(() => setRequest([]));
        }
      })
      .catch((e) => setErrorMessage(describeError(e)));
  }, [employee]);
  useFocusEffect(load);
  const shortcomings = profile ? findShortcomings(profile.editable) : [];
  const percent = profile ? completenessPercent(profile.editable) : 0;
  const isComplete = shortcomings.length === 0;
  const seenKey = `hris.pd.lengkapDilihat.${employee?.id ?? ""}`;
  useEffect(() => {
    if (!profile) return;
    if (!isComplete) {
      AsyncStorage.removeItem(seenKey).catch(() => {});
      return;
    }
    AsyncStorage.getItem(seenKey)
      .then((v) => {
        setHasSeen(v === "1");
        if (v !== "1") AsyncStorage.setItem(seenKey, "1").catch(() => {});
      })
      .catch(() => setHasSeen(false));
  }, [profile, isComplete, seenKey]);
  const shouldShowHero = !isComplete || hasSeen === false;
  const pendingRequest = request.filter((p) => p.status === "Pending");
  return {
    profile,
    errorMessage,
    photoUri,
    load,
    shortcomings,
    percent,
    isComplete,
    shouldShowHero,
    pendingRequest,
  };
}
