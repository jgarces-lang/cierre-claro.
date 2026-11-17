import { describe, expect, it } from "vitest";
import { formatCOP, ordenarPorAtraso, pendientes, activos, semilla } from "./prospects-core";

const now = Date.UTC(2026, 10, 17);
describe("CierreClaro reglas", () => {
  it("formatea pesos con punto de miles", () => {
    expect(formatCOP(450000)).toBe("$450.000");
    expect(formatCOP(2400000)).toBe("$2.400.000");
  });
  it("ordena de mayor a menor atraso", () => {
    const o = ordenarPorAtraso(semilla(now), now).map((p) => p.nombre);
    expect(o[0]).toBe("Julián Castaño");
    expect(o.at(-1)).toBe("Laura Gómez");
  });
  it("activos excluye Cerrados y pendiente es 3+ días", () => {
    const s = semilla(now);
    expect(activos(s)).toHaveLength(5);
    expect(pendientes(s, now).map((p) => p.nombre).sort()).toEqual(["Andrés Mejía", "Camila Restrepo", "Santiago Ospina"]);
  });
});
