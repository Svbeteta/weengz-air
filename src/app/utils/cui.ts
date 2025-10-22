/*
  ValidaciÃ³n CUI (Guatemala aproximada):
  - 13 dÃ­gitos numÃ©ricos.
  - DÃ­gitos 9-10: cÃ³digo de departamento 01..22
  - DÃ­gitos 11-12: cÃ³digo de municipio 01..N (segÃºn depto)
  Nota: No se incluye checksum; se valida estructura y cÃ³digos vÃ¡lidos.
*/
const municipiosPorDepto: Record<number, number> = {
  1:17, 2:8, 3:16, 4:16, 5:14, 6:19, 7:8, 8:24, 9:21, 10:9, 11:30,
  12:32, 13:21, 14:13, 15:19, 16:18, 17:14, 18:5, 19:11, 20:8, 21:17, 22:11
};

export function validarCUI(cui: string): { ok: boolean; error?: string } {
  if (!/^\d{13}$/.test(cui)) {
    return { ok: false, error: "El CUI debe contener exactamente 13 dÃ­gitos numÃ©ricos." };
  }
  const depto = parseInt(cui.substring(9, 11), 10);   // posiciones 10-11 (base 1)
  const mun   = parseInt(cui.substring(11, 13), 10);  // posiciones 12-13 (base 1)

  if (isNaN(depto) || isNaN(mun)) {
    return { ok: false, error: "CÃ³digos de departamento/municipio invÃ¡lidos." };
  }
  if (depto < 1 || depto > 22) {
    return { ok: false, error: "Departamento no vÃ¡lido (01..22)." };
  }
  const maxMun = municipiosPorDepto[depto];
  if (mun < 1 || mun > maxMun) {
    return { ok: false, error: `Municipio no vÃ¡lido (01..${maxMun}) para el departamento ${String(depto).padStart(2,"0")}.` };
  }
  return { ok: true };
}
