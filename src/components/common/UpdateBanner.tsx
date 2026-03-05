import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faXmark } from "@fortawesome/free-solid-svg-icons";

const STORAGE_KEY = "dbrice_last_seen_version";

export function UpdateBanner() {
  const [newVersion, setNewVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then((current) => {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      if (lastSeen && lastSeen !== current) {
        setNewVersion(current);
      } else {
        // First launch or same version — just store it silently
        localStorage.setItem(STORAGE_KEY, current);
      }
    });
  }, []);

  const dismiss = () => {
    if (newVersion) {
      localStorage.setItem(STORAGE_KEY, newVersion);
    }
    setNewVersion(null);
  };

  if (!newVersion) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/10 border-b text-xs text-primary">
      <FontAwesomeIcon icon={faStar} className="shrink-0" />
      <span className="flex-1">
        DBrice updated to <strong>v{newVersion}</strong> —{" "}
        <a
          href={`https://github.com/bricemab/dbrice/releases/tag/v${newVersion}`}
          target="_blank"
          rel="noreferrer"
          className="underline hover:opacity-80"
        >
          See what&apos;s new →
        </a>
      </span>
      <button
        className="shrink-0 text-primary/70 hover:text-primary transition-colors"
        onClick={dismiss}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>
  );
}
