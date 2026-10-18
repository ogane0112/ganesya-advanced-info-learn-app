import { useMemo, useState } from "react";
import { scenarios } from "./scenarios";

export const DEVICES = [
  { id: "ipad-landscape", label: "iPad 横", w: 1180, h: 820, scale: 1 },
  { id: "ipad-portrait", label: "iPad 縦", w: 820, h: 1180, scale: 1 },
  { id: "iphone", label: "iPhone", w: 390, h: 844, scale: 1.6 },
] as const;

type DeviceId = (typeof DEVICES)[number]["id"];
type Theme = "light" | "dark";

const css = `
  body { margin: 0; font-family: -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; background: #eceff3; color: #1c2330; }
  .g-head { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center;
    padding: 10px 16px; background: #fff; border-bottom: 1px solid #d5dae1; }
  .g-head h1 { font-size: 17px; margin: 0 8px 0 0; }
  .g-group { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .g-group > span { font-size: 12px; color: #687385; margin-right: 2px; }
  .g-chip { border: 1px solid #c8ced8; background: #fff; border-radius: 999px; padding: 4px 12px; font-size: 13px; cursor: pointer; }
  .g-chip[aria-pressed="true"] { background: #1f4e8c; border-color: #1f4e8c; color: #fff; }
  .g-head input[type=range] { width: 120px; }
  .g-body { padding: 16px; }
  .g-section h2 { font-size: 16px; margin: 20px 0 8px; }
  .g-card { background: #fff; border: 1px solid #d5dae1; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; }
  .g-card h3 { font-size: 14px; margin: 0; display: flex; gap: 10px; align-items: baseline; }
  .g-card h3 a { font-size: 12px; font-weight: 400; }
  .g-note { font-size: 12px; color: #687385; margin: 2px 0 8px; }
  .g-frames { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
  .g-frame figcaption { font-size: 11px; color: #687385; margin-bottom: 4px; }
  .g-viewport { overflow: hidden; border-radius: 10px; border: 1px solid #c8ced8; box-shadow: 0 2px 8px rgba(0,0,0,.06); background: #fff; }
  .g-viewport iframe { border: 0; transform-origin: 0 0; display: block; }
`;

function Toggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <div className="g-group">
      <span>{label}</span>
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            className="g-chip"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Shell() {
  const groups = useMemo(() => [...new Set(scenarios.map((s) => s.group))], []);
  const [shownGroups, setShownGroups] = useState<string[]>(groups);
  const [devices, setDevices] = useState<DeviceId[]>(["ipad-landscape", "ipad-portrait"]);
  const [themes, setThemes] = useState<Theme[]>(["light"]);
  const [zoom, setZoom] = useState(0.36);

  return (
    <>
      <style>{css}</style>
      <header className="g-head">
        <h1>UI ギャラリー</h1>
        <Toggle label="画面" options={groups.map((g) => ({ id: g, label: g }))} value={shownGroups} onChange={setShownGroups} />
        <Toggle label="端末" options={DEVICES.map((d) => ({ id: d.id, label: d.label }))} value={devices} onChange={setDevices} />
        <Toggle
          label="テーマ"
          options={[
            { id: "light" as Theme, label: "ライト" },
            { id: "dark" as Theme, label: "ダーク" },
          ]}
          value={themes}
          onChange={setThemes}
        />
        <label className="g-group">
          <span>縮尺</span>
          <input type="range" min={0.2} max={0.8} step={0.02} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
      </header>
      <main className="g-body">
        {groups
          .filter((g) => shownGroups.includes(g))
          .map((g) => (
            <section key={g} className="g-section">
              <h2>{g}</h2>
              {scenarios
                .filter((s) => s.group === g)
                .map((s) => (
                  <div key={s.id} className="g-card">
                    <h3>
                      {s.title}
                      <a href={`?scenario=${s.id}`} target="_blank" rel="noreferrer">
                        単独で開く
                      </a>
                    </h3>
                    {s.note && <p className="g-note">{s.note}</p>}
                    <div className="g-frames">
                      {themes.flatMap((theme) =>
                        DEVICES.filter((d) => devices.includes(d.id)).map((d) => {
                          const k = zoom * d.scale;
                          return (
                            <figure key={`${theme}-${d.id}`} className="g-frame" style={{ margin: 0 }}>
                              <figcaption>
                                {d.label} {d.w}×{d.h}
                                {themes.length > 1 && ` / ${theme === "dark" ? "ダーク" : "ライト"}`}
                              </figcaption>
                              <div className="g-viewport" style={{ width: d.w * k, height: d.h * k }}>
                                <iframe
                                  title={`${s.id}-${d.id}-${theme}`}
                                  src={`?scenario=${s.id}&theme=${theme}`}
                                  width={d.w}
                                  height={d.h}
                                  loading="lazy"
                                  style={{ transform: `scale(${k})` }}
                                />
                              </div>
                            </figure>
                          );
                        }),
                      )}
                    </div>
                  </div>
                ))}
            </section>
          ))}
      </main>
    </>
  );
}
