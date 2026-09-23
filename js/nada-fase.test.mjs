import { bolehPutarNadaPadaTransisi } from "./alur-ibadah.js";

if (bolehPutarNadaPadaTransisi(false) !== false) {
  throw new Error("Boot di tengah fase tidak boleh memutar nada.");
}
if (bolehPutarNadaPadaTransisi(true) !== true) {
  throw new Error("Transisi fase yang diamati harus memutar nada.");
}

console.log("2 PASS, 0 FAIL");
