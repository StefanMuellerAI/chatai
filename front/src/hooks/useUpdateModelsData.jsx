import i18n from "../i18n";
// useUpdateModelsData.js
import { useState, useEffect, useCallback } from "react";
import { getModelsData } from "../apis/getModelsData";
import { useToast } from "./useToast";
import { useModal } from "../modals/ModalContext";

export function useUpdateModelsData() {
  const [modelsData, setModelsData] = useState([]);
  const { notifyError } = useToast();
  const { openModal } = useModal();

  const updateModelsData = useCallback(async () => {
    try {
      const data = await getModelsData();

      if (data instanceof Response) {
        if (data.status === 401) openModal("errorSessionExpired");
        else notifyError(i18n.t("toast.models_fetch_failed", { status: `${data.status} ${data.statusText}` }));
        return;
      }

      if (Array.isArray(data) && data.length === 0) {
        notifyError(i18n.t("toast.models_unavailable"));
        return;
      }
      setModelsData(data);
    } catch {
      notifyError(i18n.t("toast.models_error"));
    }
  }, []);

  useEffect(() => {
    updateModelsData();
    const interval = setInterval(updateModelsData, 30000);
    return () => clearInterval(interval);
  }, [updateModelsData]);

  return modelsData;
}