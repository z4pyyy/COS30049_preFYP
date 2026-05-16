"use client";

import { Fragment, useEffect, useState } from "react";

const LANGS = [
  { code: "ms",    label: "BM"   },
  { code: "en",    label: "EN"   },
  { code: "zh-CN", label: "中文" },
] as const;

type LangCode = (typeof LANGS)[number]["code"];

function triggerGoogleTranslate(lang: LangCode) {
  const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (!select) return;
  select.value = lang;
  select.dispatchEvent(new Event("change"));
}

export default function LangSwitcher() {
  const [active, setActive] = useState<LangCode>("en");

  useEffect(() => {
    const match = document.cookie.match(/googtrans=\/en\/([^;]+)/);
    if (match) {
      const lang = match[1] as LangCode;
      if (LANGS.some((l) => l.code === lang)) setActive(lang);
    }
  }, []);

  function handleClick(code: LangCode) {
    setActive(code);
    triggerGoogleTranslate(code);
  }

  return (
    <div className="flex items-center gap-4 opacity-60 shrink-0">
      {LANGS.map((lang, i) => (
        <Fragment key={lang.code}>
          {i > 0 && <span>|</span>}
          <button
            onClick={() => handleClick(lang.code)}
            className={`hover:opacity-100 transition-opacity text-white text-[11px] ${
              active === lang.code ? "opacity-100 font-bold" : ""
            }`}
          >
            {lang.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
