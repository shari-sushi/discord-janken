import { useState, useMemo } from "react";

// ── サンプルデータ定義 ───────────────────────────────
const OWN_MEMBERS = ["自A", "自B", "自C", "自D", "自E", "自F"];
const START = new Date(2026, 5, 16); // 2026-06-16
const NUM_DAYS = 14;
const WD = ["日", "月", "火", "水", "木", "金", "土"];

// 状態：未記入(none) / 可(ok) / 検討中(maybe) / 不可(ng)
const ORDER = ["none", "ok", "maybe", "ng"];
const nextStatus = (s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length];
const STYLE = {
  none: { sym: "–", cls: "border border-slate-300 bg-white text-slate-300", label: "未記入" },
  ok: { sym: "○", cls: "bg-emerald-500 text-white", label: "参加可" },
  maybe: { sym: "△", cls: "bg-amber-400 text-white", label: "検討中" },
  ng: { sym: "×", cls: "bg-rose-400 text-white", label: "不可" },
};

// 左固定カラムの幅と左オフセット(px)
const W = { date: 72, count: 48, oppA: 64, oppB: 64, seiritsu: 56 };
const LEFT = { date: 0, count: 72, oppA: 120, oppB: 184, seiritsu: 248 };
const MEMBER_W = 68;
const pin = (key, isHeader) => ({
  position: "sticky",
  left: LEFT[key] + "px",
  width: W[key] + "px",
  minWidth: W[key] + "px",
  top: isHeader ? 0 : undefined,
  zIndex: isHeader ? 30 : 10,
});

function buildDates() {
  const arr = [];
  for (let i = 0; i < NUM_DAYS; i++) {
    const d = new Date(START);
    d.setDate(START.getDate() + i);
    arr.push({ idx: i, label: `${d.getMonth() + 1}/${d.getDate()}`, wd: WD[d.getDay()], sunday: d.getDay() === 0, saturday: d.getDay() === 6 });
  }
  return arr;
}
function initOwn() {
  const o = {};
  OWN_MEMBERS.forEach((m, mi) => {
    o[m] = {};
    for (let i = 0; i < NUM_DAYS; i++) {
      const r = (i * 5 + mi * 7) % 12;
      const status = r === 0 || r === 1 ? "ng" : r === 2 ? "maybe" : r === 3 ? "none" : "ok";
      o[m][i] = { status, note: status === "ok" && i % 4 === 0 ? "21~" : "" };
    }
  });
  return o;
}
function initOpp() {
  const mk = (seed) => {
    const r = {};
    for (let i = 0; i < NUM_DAYS; i++) {
      const v = (i * seed) % 4;
      const status = v === 0 ? "none" : v === 1 ? "ng" : v === 2 ? "maybe" : "ok";
      r[i] = { status, note: status === "ok" && i % 3 === 0 ? "21:00~" : "" };
    }
    return r;
  };
  return { A: mk(2), B: mk(3) };
}

// ── セル：状態トグル + 時間メモ ──────────────────────
function Cell({ status, note, editable, highlight, dim, onCycle, onNote, tdClassName = "", tdStyle }) {
  const st = STYLE[status];
  return (
    <td
      className={"border-b border-r border-slate-200 px-1.5 py-1.5 align-top text-center " + (highlight ? "bg-indigo-50 " : "") + tdClassName}
      style={tdStyle}
    >
      <button
        onClick={editable ? onCycle : undefined}
        disabled={!editable}
        className={"mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 " + st.cls + (editable ? " cursor-pointer hover:opacity-80" : " cursor-default") + (dim ? " opacity-40" : "")}
        aria-label={st.label}
      >
        {st.sym}
      </button>
      {editable ? (
        <input value={note} onChange={(e) => onNote(e.target.value)} placeholder="時間" className="mt-1 w-14 rounded border border-slate-200 px-1 py-0.5 text-center text-[11px] text-slate-700 focus:border-indigo-400 focus:outline-none" />
      ) : (
        <div className="mt-1 h-[18px] text-[11px] leading-[18px] text-slate-500">{note || ""}</div>
      )}
    </td>
  );
}

export default function App() {
  const dates = useMemo(buildDates, []);
  const [own, setOwn] = useState(initOwn);
  const [opp, setOpp] = useState(initOpp);
  const [threshold, setThreshold] = useState(5);
  const [role, setRole] = useState("自C");

  const isOwnEditable = (m) => role === m;
  const isOppEditable = () => role === "opp";

  const cycleOwn = (m, i) => setOwn((p) => ({ ...p, [m]: { ...p[m], [i]: { ...p[m][i], status: nextStatus(p[m][i].status) } } }));
  const noteOwn = (m, i, v) => setOwn((p) => ({ ...p, [m]: { ...p[m], [i]: { ...p[m][i], note: v } } }));
  const cycleOpp = (t, i) => setOpp((p) => ({ ...p, [t]: { ...p[t], [i]: { ...p[t][i], status: nextStatus(p[t][i].status) } } }));
  const noteOpp = (t, i, v) => setOpp((p) => ({ ...p, [t]: { ...p[t], [i]: { ...p[t][i], note: v } } }));

  const N = OWN_MEMBERS.length;
  const rows = dates.map((d) => {
    const statuses = OWN_MEMBERS.map((m) => own[m][d.idx].status);
    const okCount = statuses.filter((s) => s === "ok").length;
    const maybeCount = statuses.filter((s) => s === "maybe").length;
    const ngCount = statuses.filter((s) => s === "ng").length;
    const impossible = N - ngCount < threshold;
    const oppOk = opp.A[d.idx].status === "ok" || opp.B[d.idx].status === "ok";
    const ok = okCount >= threshold && oppOk;
    return { ...d, okCount, maybeCount, ngCount, impossible, oppOk, ok };
  });

  const hb = "border-b border-r border-slate-200 px-2 py-2 text-xs font-semibold";

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-800">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-lg font-bold tracking-tight text-slate-900">スクリム調整</h1>
        <p className="mt-0.5 text-sm text-slate-500">{threshold}人以上そろって、相手も空いてる日を探す</p>

        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">あなた</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 font-medium focus:border-indigo-400 focus:outline-none">
              {OWN_MEMBERS.map((m) => (<option key={m} value={m}>{m}（個人）</option>))}
              <option value="opp">相手admin（A/B編集）</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">成立に必要な人数</span>
            <select value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="rounded border border-slate-300 bg-white px-2 py-1 font-medium focus:border-indigo-400 focus:outline-none">
              {[3, 4, 5, 6].map((n) => (<option key={n} value={n}>{n}人</option>))}
            </select>
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
            <span><span className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 align-middle text-[9px] text-white">○</span>可</span>
            <span><span className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 align-middle text-[9px] text-white">△</span>検討中</span>
            <span><span className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-400 align-middle text-[9px] text-white">×</span>不可</span>
            <span><span className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-300 bg-white align-middle text-[9px] text-slate-300">–</span>未記入</span>
          </div>
        </div>

        <div className="mt-3 overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className={hb + " bg-slate-100 text-left"} style={pin("date", true)}>日付</th>
                <th className={hb + " bg-slate-100 text-slate-600 text-center"} style={pin("count", true)}>○数</th>
                {["A", "B"].map((t) => (
                  <th key={t} className={hb + " text-center " + (isOppEditable() ? "bg-indigo-600 text-white" : "bg-amber-50 text-amber-700")} style={pin(t === "A" ? "oppA" : "oppB", true)}>相手{t}</th>
                ))}
                <th className={hb + " bg-slate-100 text-slate-600 text-center"} style={pin("seiritsu", true)}>成立</th>
                {OWN_MEMBERS.map((m) => (
                  <th key={m} className={hb + " text-center sticky top-0 " + (isOwnEditable(m) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")} style={{ minWidth: MEMBER_W, zIndex: 20 }}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rowBg = r.ok ? "bg-emerald-50" : r.impossible ? "bg-slate-50" : "bg-white";
                const trCls = r.impossible ? "opacity-70" : r.ok ? "bg-emerald-50" : "";
                const wkColor = r.sunday ? "text-rose-500" : r.saturday ? "text-sky-600" : "text-slate-700";
                return (
                  <tr key={r.idx} className={trCls}>
                    <td className={"border-b border-r border-slate-200 px-2 py-1.5 text-left text-xs font-medium " + rowBg + " " + wkColor} style={pin("date")}>
                      {r.label}<span className="ml-0.5 text-[11px]">({r.wd})</span>
                    </td>
                    <td className={"border-b border-r border-slate-200 px-1 py-1.5 text-center text-sm font-bold " + rowBg + " " + (r.okCount >= threshold ? "text-emerald-600" : "text-slate-400")} style={pin("count")}>
                      {r.okCount}{r.maybeCount > 0 && <span className="ml-0.5 text-[10px] font-normal text-amber-500">+{r.maybeCount}△</span>}
                    </td>
                    {["A", "B"].map((t) => (
                      <Cell key={t} status={opp[t][r.idx].status} note={opp[t][r.idx].note} editable={isOppEditable()} highlight={isOppEditable()} dim={opp[t][r.idx].status === "ng"} onCycle={() => cycleOpp(t, r.idx)} onNote={(v) => noteOpp(t, r.idx, v)} tdClassName={isOppEditable() ? "" : rowBg} tdStyle={pin(t === "A" ? "oppA" : "oppB")} />
                    ))}
                    <td className={"border-b border-r border-slate-200 px-1 py-1.5 text-center " + rowBg} style={pin("seiritsu")}>
                      {r.ok ? (<span className="inline-block rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">成立</span>) : (<span className="text-xs text-slate-300">—</span>)}
                    </td>
                    {OWN_MEMBERS.map((m) => (
                      <Cell key={m} status={own[m][r.idx].status} note={own[m][r.idx].note} editable={isOwnEditable(m)} highlight={isOwnEditable(m)} onCycle={() => cycleOwn(m, r.idx)} onNote={(v) => noteOwn(m, r.idx, v)} tdStyle={{ minWidth: MEMBER_W }} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          ※モック。日付・○数・相手A/B・成立を左に固定し、自チーム各メンバーは右に横スクロール。セルをタップで 未記入→○→△→× を循環。○数が必要人数以上＋相手どちらか○で「成立」。×が増えて必要人数に届かない確定の日は行を薄く（自チーム基準）。相手は×セルだけ薄く。時間は自由記入なので○数は時間の重なりまでは見ていない。
        </p>
      </div>
    </div>
  );
}
