import { formatJamWIB } from "./waktu.js";

export function mulaiJamFokus() {
  const render = () => {
    const jam = formatJamWIB(new Date());
    document.querySelectorAll(".fokus-jam").forEach((el) => { el.textContent = jam; });
  };

  render();
  const intervalId = setInterval(render, 1000);
  return () => clearInterval(intervalId);
}
