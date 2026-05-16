"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    googleTranslateElementInit: () => void;
    google: {
      translate: {
        TranslateElement: new (
          opts: Record<string, unknown>,
          el: string
        ) => void;
      };
    };
  }
}

// Stamp translate="no" on every Material Symbols icon span found in the DOM.
// Called once on mount and again on any subtree mutation so dynamically
// rendered icons (modals, async components) are protected automatically.
function protectIcons() {
  document.querySelectorAll<HTMLElement>(
    ".material-symbols-outlined:not([translate])"
  ).forEach((el) => {
    el.setAttribute("translate", "no");
  });
}

export default function GoogleTranslate() {
  useEffect(() => {
    if (document.getElementById("gt-script")) return;

    // Protect icons already in the DOM before GT loads.
    protectIcons();

    // Watch for new icons rendered by dynamic components / page navigation.
    const observer = new MutationObserver(protectIcons);
    observer.observe(document.body, { childList: true, subtree: true });

    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        { pageLanguage: "en", includedLanguages: "en,ms,zh-CN", autoDisplay: false },
        "google_translate_element"
      );
    };

    const script = document.createElement("script");
    script.id = "gt-script";
    script.src =
      "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.head.appendChild(script);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      id="google_translate_element"
      aria-hidden="true"
      style={{ display: "none", visibility: "hidden", position: "absolute" }}
    />
  );
}
