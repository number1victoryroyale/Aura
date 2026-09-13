import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const config = window.AURA_FIREBASE_CONFIG;
const isConfigured = !!config && Object.values(config).every((v) => v && v !== "REPLACE_ME");

if (isConfigured) {
  initLeaderboard(config);
}

function initLeaderboard(config) {
  const section = document.getElementById("leaderboard-panel");
  const joinEl = document.getElementById("leaderboard-join");
  const nameInput = document.getElementById("leaderboard-name-input");
  const joinBtn = document.getElementById("leaderboard-join-btn");
  const renameBtn = document.getElementById("leaderboard-rename-btn");
  const listEl = document.getElementById("leaderboard-list");
  const statusEl = document.getElementById("leaderboard-status");

  let db;
  try {
    const app = initializeApp(config);
    db = getFirestore(app);
  } catch (e) {
    console.warn("Leaderboard unavailable:", e);
    return;
  }

  section.hidden = false;

  const playerId = getPlayerId();
  let playerName = localStorage.getItem("aura-player-name") || "";

  function showJoinForm() {
    joinEl.hidden = false;
    nameInput.value = playerName;
    nameInput.focus();
  }

  function submitName() {
    const name = nameInput.value.trim().slice(0, 24);
    if (!name) return;
    playerName = name;
    localStorage.setItem("aura-player-name", name);
    joinEl.hidden = true;
    pushScore();
  }

  joinBtn.addEventListener("click", submitName);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitName();
  });
  renameBtn.addEventListener("click", showJoinForm);

  function pushScore() {
    if (!playerName) return;
    const aura = window.Aura ? window.Aura.getAura() : 0;
    setDoc(doc(db, "leaderboard", playerId), {
      name: playerName,
      aura,
      updatedAt: Date.now(),
    }).catch((e) => {
      console.warn("Couldn't write to leaderboard:", e);
      showStatus("Couldn't reach the shared board.");
    });
  }

  function showStatus(text) {
    statusEl.textContent = text;
    statusEl.hidden = false;
  }

  window.addEventListener("aura:change", pushScore);

  if (playerName) {
    pushScore();
  } else {
    showJoinForm();
  }

  const leaderboardQuery = query(collection(db, "leaderboard"), orderBy("aura", "desc"), limit(20));
  onSnapshot(
    leaderboardQuery,
    (snapshot) => {
      statusEl.hidden = true;
      listEl.hidden = false;
      listEl.innerHTML = "";
      let rank = 0;
      snapshot.forEach((docSnap) => {
        rank += 1;
        const data = docSnap.data();
        listEl.appendChild(renderRow(rank, docSnap.id, data));
      });
      if (rank === 0) {
        listEl.hidden = true;
        showStatus("No flames on the board yet — be the first.");
      }
    },
    (error) => {
      console.warn("Leaderboard subscription failed:", error);
      listEl.hidden = true;
      showStatus("Couldn't reach the shared board.");
    }
  );

  function renderRow(rank, id, data) {
    const li = document.createElement("li");
    li.className = "leaderboard-row rank-" + rank;
    if (id === playerId) li.classList.add("you-row");

    const rankEl = document.createElement("span");
    rankEl.className = "lb-rank";
    rankEl.textContent = "#" + rank;

    const nameEl = document.createElement("span");
    nameEl.className = "lb-name";
    nameEl.textContent = data.name || "???";
    if (id === playerId) {
      const tag = document.createElement("span");
      tag.className = "lb-you-tag";
      tag.textContent = " (you)";
      nameEl.appendChild(tag);
    }

    const valueEl = document.createElement("span");
    valueEl.className = "lb-aura";
    const auraValue = typeof data.aura === "number" ? data.aura : 0;
    valueEl.textContent = window.Aura ? window.Aura.formatNumber(auraValue) : String(auraValue);

    li.appendChild(rankEl);
    li.appendChild(nameEl);
    li.appendChild(valueEl);
    return li;
  }
}

function getPlayerId() {
  let id = localStorage.getItem("aura-player-id");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem("aura-player-id", id);
  }
  return id;
}
