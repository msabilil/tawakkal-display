export function buatIkonJadwal(key) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const path = (d) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("d", d);
    svg.append(el);
  };
  if (key === "subuh") {
    path("M3 18h18M5.5 15a6.5 6.5 0 0 1 13 0M12 3v4M5.5 7.5l2 2M18.5 7.5l-2 2");
  } else if (key === "dzuhur") {
    path("M12 4v2M12 18v2M4 12h2M18 12h2M6.35 6.35l1.4 1.4M16.25 16.25l1.4 1.4M17.65 6.35l-1.4 1.4M7.75 16.25l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z");
  } else if (key === "ashar") {
    path("M7 14a4 4 0 0 1 7.6-1.75A3.5 3.5 0 0 1 18 17H7a3 3 0 0 1 0-6M12 3v2M5 6l1.5 1.5M19 6l-1.5 1.5");
  } else if (key === "maghrib") {
    path("M3 18h18M5.5 15a6.5 6.5 0 0 1 13 0M12 4v3M5 8l2 2M19 8l-2 2");
  } else {
    path("M19 15.5A8 8 0 0 1 8.5 5 8 8 0 1 0 19 15.5Z");
  }

  svg.setAttribute("class", `jadwal-strip-waktu-ikon jadwal-strip-waktu-ikon-${key}`);
  svg.setAttribute("aria-hidden", "true");
  return svg;
}
