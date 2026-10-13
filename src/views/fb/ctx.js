import { createContext, useContext } from "react";

/* Contexto del módulo: datos (fb), estilos (c), navegación y ventanas compartidas. */
export const FbCtx = createContext(null);
export const useFbCtx = () => useContext(FbCtx);
