"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Kind, PortalRecord } from "./model";

type View = Kind | "all" | "favorites";
type State = {
  records: PortalRecord[]; view: View; query: string; tag: string; selected: string | null;
  loading: boolean; error: string; busy: boolean; theme: "light" | "dark";
  setView: (view: View) => void; setQuery: (query: string) => void; setTag: (tag: string) => void;
  select: (id: string | null) => void; toggleTheme: () => void;
  load: () => Promise<void>; save: (item: PortalRecord) => Promise<PortalRecord>;
  remove: (item: PortalRecord) => Promise<void>; reorder: (ids: string[]) => Promise<void>;
};
async function responseJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "操作失败，请重试");
  return body;
}
export const usePortal = create<State>()(persist((set, get) => ({
  records: [], view: "all", query: "", tag: "", selected: null, loading: true, error: "", busy: false, theme: "light",
  setView: view => set({ view, tag: "", selected: null }), setQuery: query => set({ query }),
  setTag: tag => set({ tag }), select: selected => set({ selected }),
  toggleTheme: () => set({ theme: get().theme === "light" ? "dark" : "light" }),
  load: async () => {
    set({ loading: true, error: "" });
    try { set({ records: await responseJson(await fetch("/api/records", { cache: "no-store" })), loading: false }); }
    catch (error) { set({ loading: false, error: (error as Error).message }); }
  },
  save: async item => {
    set({ busy: true });
    try {
      const saved: PortalRecord = await responseJson(await fetch("/api/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) }));
      set(state => ({ records: [...state.records.filter(r => r.id !== saved.id), saved], selected: saved.id }));
      return saved;
    } finally { set({ busy: false }); }
  },
  remove: async item => {
    set({ busy: true });
    try {
      await responseJson(await fetch(`/api/records?id=${encodeURIComponent(item.id)}&version=${item.version}`, { method: "DELETE" }));
      set(state => ({ records: state.records.filter(r => r.id !== item.id), selected: null }));
    } finally { set({ busy: false }); }
  },
  reorder: async ids => {
    // Keep the complete collection ordering stable, including records hidden by a filter.
    const selected = get().selected;
    const current = [...get().records].sort((a,b) => a.order - b.order);
    let index = 0;
    const byId = new Map(current.map(r => [r.id, r]));
    const visible = new Set(ids);
    const ordered = current.map(r => visible.has(r.id) ? byId.get(ids[index++])! : r);
    try {
      for (let i=0; i<ordered.length; i++) if (ordered[i].order !== i) await get().save({ ...ordered[i], order: i });
      set({ selected });
    } catch (error) { await get().load(); throw error; }
  },
}), { name: "dev-portal-preferences", partialize: state => ({ theme: state.theme }) }));
