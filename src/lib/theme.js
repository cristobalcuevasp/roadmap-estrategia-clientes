import { createContext, useContext } from "react";

export function tokens(dark) {
  return {
    dark,
    app: dark ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-800",
    panel: dark ? "bg-slate-900" : "bg-white",
    panelBorder: dark ? "border-slate-800" : "border-slate-200",
    border: dark ? "border-slate-800" : "border-slate-200",
    borderSubtle: dark ? "border-slate-800" : "border-slate-100",
    divide: dark ? "divide-slate-800" : "divide-slate-100",
    text: dark ? "text-slate-200" : "text-slate-800",
    textDim: dark ? "text-slate-400" : "text-slate-500",
    textFaint: dark ? "text-slate-500" : "text-slate-400",
    column: dark ? "bg-slate-900" : "bg-slate-100",
    card: dark ? "bg-slate-800" : "bg-white",
    cardBorder: dark ? "border-slate-700" : "border-slate-200",
    cardHover: dark ? "hover:bg-slate-700 hover:border-slate-600" : "hover:border-slate-300",
    rowHover: dark ? "hover:bg-slate-800" : "hover:bg-slate-50",
    input: dark ? "bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500" : "bg-white border-slate-300 text-slate-800 placeholder-slate-400",
    inputBare: dark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-transparent",
    chipIdle: dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100",
    navActive: dark ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-900",
    navIdle: dark ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
    groupLabel: dark ? "text-slate-600" : "text-slate-400",
    kbd: dark ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-300 text-slate-500",
  };
}
export const ThemeCtx = createContext({ dark: true });
export const useTheme = () => useContext(ThemeCtx);
