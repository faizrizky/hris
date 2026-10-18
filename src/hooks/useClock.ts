import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { ClockState } from "@/services/types";
import { isFaceSupported } from "@/services/faceCheck";
import { describeError } from "@/services/api/http";
import { useWorkLocation } from "@/hooks/useWorkLocation";
import { setTabBarHidden } from "@/navigation/tabBarVisibility";
import type { FaceStatus, SpoofSummary } from "@/services/types";

export function useClock() {
  const { employee } = useSession();
  const [state, setState] = useState<ClockState | null>(null);
  const [step, setStep] = useState(0);
  const [completedAction, setCompletedAction] = useState<"IN" | "OUT" | null>(
    null,
  );
  const { permission, fix, nearest, geofenceRule, latestFetch } =
    useWorkLocation(step < 2);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFacePassed, setHasFacePassed] = useState(false);
  const [faceStatus, setFaceStatus] = useState<FaceStatus | null>(null);
  const [faceVec, setFaceVec] = useState<number[] | null>(null);
  const [spoof, setSpoof] = useState<SpoofSummary | null>(null);
  const handleFacePassed = useCallback(
    (v: number[] | null, spoof?: SpoofSummary) => {
      setFaceVec(v);
      setSpoof(spoof ?? null);
      setHasFacePassed(true);
    },
    [],
  );
  const isFaceOk = hasFacePassed || !isFaceSupported();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!employee) return;
    setLoadError(null);
    hrisApi
      .getClockState(employee.id)
      .then(setState)
      .catch((e) => setLoadError(describeError(e)));
    hrisApi
      .getFaceStatus()
      .then(setFaceStatus)
      .catch(() => setFaceStatus(null));
  }, [employee]);
  useFocusEffect(load);
  useFocusEffect(
    useCallback(() => {
      setTabBarHidden(step === 1);
      return () => setTabBarHidden(false);
    }, [step]),
  );
  return {
    state,
    setState,
    step,
    setStep,
    completedAction,
    setCompletedAction,
    permission,
    fix,
    nearest,
    geofenceRule,
    latestFetch,
    isLoading,
    setIsLoading,
    setHasFacePassed,
    faceStatus,
    faceVec,
    setFaceVec,
    spoof,
    setSpoof,
    handleFacePassed,
    isFaceOk,
    errorMessage,
    setErrorMessage,
    loadError,
    load,
  };
}
