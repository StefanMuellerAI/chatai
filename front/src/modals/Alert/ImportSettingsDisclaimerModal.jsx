import { useEffect, useMemo, useState } from "react";
import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function ImportSettingsDisclaimerModal({
  isOpen,
  onClose,
  hasWebSearch,
  hasMcpServers,
  onResolve,
}) {
  const [allowWebSearch, setAllowWebSearch] = useState(true);
  const [allowMcpServers, setAllowMcpServers] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setAllowWebSearch(true);
    setAllowMcpServers(true);
  }, [isOpen]);

  const options = useMemo(() => {
    return [
      hasWebSearch
        ? {
            key: "web_search",
            checked: allowWebSearch,
            onChange: setAllowWebSearch,
            labelKey: "settings.label_web_search",
            bodyKey: "alert.import_web_search_disclaimer",
            tone: "red",
          }
        : null,
      hasMcpServers
        ? {
            key: "mcp_servers",
            checked: allowMcpServers,
            onChange: setAllowMcpServers,
            labelKey: "settings.label_mcp_server",
            bodyKey: "alert.import_mcp_disclaimer",
            tone: "yellow",
          }
        : null,
    ].filter(Boolean);
  }, [allowMcpServers, allowWebSearch, hasMcpServers, hasWebSearch]);

  const resolveAndClose = (payload) => {
    onResolve?.(payload);
    onClose?.();
  };

  const handleCancel = () => resolveAndClose({ action: "cancel" });

  const handleAllow = () =>
    resolveAndClose({
      action: "allow",
      allowWebSearch: hasWebSearch ? allowWebSearch : true,
      allowMcpServers: hasMcpServers ? allowMcpServers : true,
    });

  const handleDisallow = () => resolveAndClose({ action: "disallow" });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleCancel}
      titleKey="alert.import_settings_title"
      maxWidth="max-w-lg"
      minimal={true}
    >
      <div className="flex flex-col gap-3">
        <p className="text-red-600">
          <Trans i18nKey="common.disclaimer" />
        </p>
        <p className="dark:text-white text-black text-sm whitespace-pre-line">
          <Trans i18nKey="alert.import_settings_intro" />
        </p>

        <div className="flex flex-col gap-2">
          {options.map((opt) => {
            const toneClasses =
              opt.tone === "red"
                ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20";
            return (
              <label
                key={opt.key}
                className={[
                  "flex items-start gap-3 rounded-xl border p-3",
                  toneClasses,
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={opt.checked}
                  onChange={(e) => opt.onChange(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out"
                />
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    <Trans i18nKey={opt.labelKey} />
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-line">
                    <Trans i18nKey={opt.bodyKey} />
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row gap-2 pt-3 justify-center w-full">
          <button
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
            onClick={handleAllow}
          >
            <Trans i18nKey="common.allow" />
          </button>
          <button
            className="text-white p-3 bg-gray-700 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
            onClick={handleDisallow}
          >
            <Trans i18nKey="common.disallow" />
          </button>
          <button
            className="text-primary dark:text-tertiary p-3 justify-center items-center md:w-fit w-full min-w-[150px] select-none cursor-pointer"
            onClick={handleCancel}
          >
            <Trans i18nKey="common.cancel" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

