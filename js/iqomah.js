const KEY = "iqomahAktif";

function pad(n) { return String(n).padStart(2, "0"); }

function fmtMenitDetik(totalDetik) {
  const m = Math.floor(totalDetik / 60);
  const d = totalDetik % 60;
  return `${pad(m)}:${pad(d)}`;
}

function bacaState() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function tick() {
  const data = bacaState();
  if (!data || !data.endTime) {
    location.replace("index.html");
    return;
  }
  const sisaMs = new Date(data.endTime) - new Date();
  if (sisaMs <= 0) {
    localStorage.removeItem(KEY);
    location.replace("index.html");
    return;
  }
  document.getElementById("iqomah-nama").textContent = data.label;
  document.getElementById("iqomah-waktu").textContent = fmtMenitDetik(Math.ceil(sisaMs / 1000));
}

tick();
setInterval(tick, 1000);
