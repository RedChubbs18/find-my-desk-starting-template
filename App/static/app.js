const state = {
  currentFloor: "ground",
  currentView: "bookings",
  selectedDeskId: null,
  selectedSlot: "full",
  recommendedDeskIds: [],
  desks: [],
  bookings: {},
  user: null,
  users: [],
  settings: {
    deskPreferences: [],
    preferredUsers: [],
    anchorDays: [],
  },
  validDeskPreferences: [],
  busyness: null,
  weather: null,
  userHistory: {
    favouriteDesks: [],
    favouriteFloors: [],
    favouriteZones: [],
  },
};

const bookingDateInput = document.getElementById("bookingDate");
const floorImage = document.getElementById("floorImage");
const deskLayer = document.getElementById("deskLayer");
const floorSummary = document.getElementById("floorSummary");
const selectedDeskCard = document.getElementById("selectedDeskCard");
const bookButton = document.getElementById("bookButton");
const cancelButton = document.getElementById("cancelButton");
const bookingList = document.getElementById("bookingList");
const officeBusyMeta = document.getElementById("officeBusyMeta");
const recommendationMeta = document.getElementById("recommendationMeta");
const recommendedDeskList = document.getElementById("recommendedDeskList");
const userBadge = document.getElementById("userBadge");
const userSwitchSelect = document.getElementById("userSwitchSelect");
const signInButton = document.getElementById("signInButton");
const signOutButton = document.getElementById("signOutButton");
const pinTemplate = document.getElementById("deskPinTemplate");
const settingsForm = document.getElementById("settingsForm");
const preferredUserSearch = document.getElementById("preferredUserSearch");
const preferredUserResults = document.getElementById("preferredUserResults");
const selectedPreferredUsers = document.getElementById("selectedPreferredUsers");
const resetSettingsButton = document.getElementById("resetSettingsButton");
const deskPreferencesGrid = document.getElementById("deskPreferencesGrid");
const slotToggle = document.getElementById("slotToggle");
const releaseDeskButton = document.getElementById("releaseDeskButton");
const extendStayButton = document.getElementById("extendStayButton");
const weatherHeadline = document.getElementById("weatherHeadline");
const weatherSummary = document.getElementById("weatherSummary");
const weatherDetail = document.getElementById("weatherDetail");
const weatherTemperature = document.getElementById("weatherTemperature");
const weatherSource = document.getElementById("weatherSource");
const weatherIcon = document.getElementById("weatherIcon");
const weatherPanel = document.getElementById("weatherPanel");
const reportsWindowSelect = document.getElementById("reportsWindow");
const reportsMeta = document.getElementById("reportsMeta");
const TEAM_NEARBY_DISTANCE = 18;

async function loadDeskPreferenceOptions() {
  try {
    const payload = await fetchJSON("/api/user-settings/options");
    state.validDeskPreferences = Array.isArray(payload.deskPreferences)
      ? payload.deskPreferences
      : [];
  } catch {
    state.validDeskPreferences = [];
  }
}

function renderDeskPreferenceOptions() {
  if (!deskPreferencesGrid) return;
  deskPreferencesGrid.innerHTML = "";

  if (state.validDeskPreferences.length === 0) {
    deskPreferencesGrid.innerHTML = "<span class='muted'>No desk preference options are available right now.</span>";
    return;
  }

  state.validDeskPreferences.forEach((value) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "deskPreferences";
    input.value = value;

    label.append(input, ` ${formatPreference(value)}`);
    deskPreferencesGrid.appendChild(label);
  });
}

async function loadUserHistory() {
  try {
    const data = await fetchJSON("/api/reports?days=90");
    state.userHistory = {
      favouriteDesks: Array.isArray(data.favouriteDesks) ? data.favouriteDesks : [],
      favouriteFloors: Array.isArray(data.byFloor) ? data.byFloor : [],
      favouriteZones: Array.isArray(data.byZone) ? data.byZone : [],
    };
  } catch {
    state.userHistory = { favouriteDesks: [], favouriteFloors: [], favouriteZones: [] };
  }
}

async function loadSettings() {
  try {
    const parsed = await fetchJSON("/api/user-settings");
    state.settings = {
      deskPreferences: Array.isArray(parsed.deskPreferences) ? parsed.deskPreferences : [],
      preferredUsers: Array.isArray(parsed.preferredUsers) ? parsed.preferredUsers : [],
      anchorDays: Array.isArray(parsed.anchorDays) ? parsed.anchorDays : [],
    };
  } catch {
    state.settings = { deskPreferences: [], preferredUsers: [], anchorDays: [] };
  }
}

async function saveSettings() {
  const payload = await fetchJSON("/api/user-settings", {
    method: "PUT",
    body: JSON.stringify(state.settings),
  });

  state.settings = {
    deskPreferences: Array.isArray(payload.deskPreferences) ? payload.deskPreferences : [],
    preferredUsers: Array.isArray(payload.preferredUsers) ? payload.preferredUsers : [],
    anchorDays: Array.isArray(payload.anchorDays) ? payload.anchorDays : [],
  };

  return payload;
}

function getUserByEmail(email) {
  if (!email) return undefined;
  const normalized = String(email).toLowerCase();
  return state.users.find((user) => (user.email || "").toLowerCase() === normalized);
}

function currentUserTeam() {
  const profile = activeUserProfile();
  const team = profile?.team;
  return team ? String(team).trim().toLowerCase() : "";
}

function isTeammateEmail(email) {
  const myTeam = currentUserTeam();
  if (!myTeam) return false;
  const myEmail = (state.user?.email || "").toLowerCase();
  const otherEmail = String(email || "").toLowerCase();
  if (!otherEmail || otherEmail === myEmail) return false;
  const other = getUserByEmail(otherEmail);
  const otherTeam = other?.team ? String(other.team).trim().toLowerCase() : "";
  return Boolean(otherTeam) && otherTeam === myTeam;
}

function getDeskOccupants(desk) {
  if (!desk) return [];
  const slots = desk.slots || {};
  return [slots.full, slots.am, slots.pm].filter(Boolean);
}

function getUserBookingOnDesk(desk) {
  const myEmail = (state.user?.email || "").toLowerCase();
  if (!myEmail) return null;
  return getDeskOccupants(desk).find(
    (booking) => String(booking.email || "").toLowerCase() === myEmail
  ) || null;
}

function computeAvailableSlots(desk) {
  const slots = desk?.slots || {};
  if (slots.full) return new Set();
  const amTaken = Boolean(slots.am);
  const pmTaken = Boolean(slots.pm);
  if (amTaken && pmTaken) return new Set();
  const available = new Set();
  if (!amTaken) available.add("am");
  if (!pmTaken) available.add("pm");
  if (!amTaken && !pmTaken) available.add("full");
  return available;
}

function getTeammateBookedDesks() {
  return state.desks.filter((desk) =>
    getDeskOccupants(desk).some(
      (booking) => booking.email && isTeammateEmail(booking.email)
    )
  );
}

function isNearTeammateBookedDesk(desk) {
  if (!desk || !desk.available) return false;

  const teammateBookedDesks = getTeammateBookedDesks();
  if (teammateBookedDesks.length === 0) return false;

  return teammateBookedDesks.some((bookedDesk) => {
    if (bookedDesk.floor !== desk.floor) return false;

    const dx = Number(desk.x) - Number(bookedDesk.x);
    const dy = Number(desk.y) - Number(bookedDesk.y);
    return Math.hypot(dx, dy) <= TEAM_NEARBY_DISTANCE;
  });
}

function preferenceMatchesDesk(desk, pref, features) {
  if (pref === "window-seat") {
    return desk.nearWindow === true;
  }
  if (pref === "near-team") {
    return isNearTeammateBookedDesk(desk);
  }
  if (pref === "half-day-desks") {
    const slots = desk.slots || {};
    if (slots.full) return false;
    return Boolean(slots.am) !== Boolean(slots.pm);
  }
  return features.includes(pref);
}

function renderSelectedPreferredUsers() {
  if (!selectedPreferredUsers) return;
  selectedPreferredUsers.innerHTML = "";

  if (state.settings.preferredUsers.length === 0) {
    selectedPreferredUsers.innerHTML = "<span class='muted'>No people selected yet.</span>";
    return;
  }

  state.settings.preferredUsers.forEach((email) => {
    const user = getUserByEmail(email);
    if (!user) return;

    const chip = document.createElement("span");
    chip.className = "person-chip";
    chip.textContent = user.fullName;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "chip-remove";
    removeButton.setAttribute("aria-label", `Remove ${user.fullName}`);
    removeButton.textContent = "x";
    removeButton.addEventListener("click", () => {
      state.settings.preferredUsers = state.settings.preferredUsers.filter((entry) => entry !== email);
      renderSelectedPreferredUsers();
      renderPreferredUserResults(preferredUserSearch.value);
    });

    chip.appendChild(removeButton);
    selectedPreferredUsers.appendChild(chip);
  });
}

function renderPreferredUserResults(query = "") {
  if (!preferredUserResults) return;
  preferredUserResults.innerHTML = "";
  const activeUserEmail = (state.user?.email || "").toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    preferredUserResults.classList.add("hidden");
    return;
  }

  preferredUserResults.classList.remove("hidden");
  const availableUsers = state.users.filter((user) => {
    if ((user.email || "").toLowerCase() === activeUserEmail) return false;
    if (state.settings.preferredUsers.includes(user.email)) return false;

    const text = `${user.fullName || ""} ${user.team || ""}`.toLowerCase();
    return text.includes(normalizedQuery);
  });

  if (availableUsers.length === 0) {
    preferredUserResults.innerHTML = "<div class='muted'>No matches found.</div>";
    return;
  }

  availableUsers.slice(0, 20).forEach((user) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "person-option";
    option.append(
      createElement("strong", user.fullName),
      createElement("span", user.team || "No team")
    );
    option.addEventListener("click", () => {
      if (!state.settings.preferredUsers.includes(user.email)) {
        state.settings.preferredUsers.push(user.email);
      }
      preferredUserSearch.value = "";
      renderSelectedPreferredUsers();
      renderPreferredUserResults("");
    });
    preferredUserResults.appendChild(option);
  });
}

function hydrateSettingsForm() {
  if (!settingsForm) return;
  settingsForm.querySelectorAll('input[name="deskPreferences"]').forEach((input) => {
    input.checked = state.settings.deskPreferences.includes(input.value);
  });
  settingsForm.querySelectorAll('input[name="anchorDays"]').forEach((input) => {
    input.checked = state.settings.anchorDays.includes(input.value);
  });
  renderSelectedPreferredUsers();
  renderPreferredUserResults(preferredUserSearch?.value || "");
}

function switchView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll(".nav-tab").forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive);
  });
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.viewPanel !== viewName);
  });
  weatherPanel?.classList.toggle("hidden", viewName !== "bookings");
}

async function refreshSettingsFromDb() {
  await Promise.all([loadSettings(), loadDeskPreferenceOptions()]);
  renderDeskPreferenceOptions();
  hydrateSettingsForm();
}

function deskMatchesPreferences(desk) {
  const preferences = state.settings.deskPreferences;
  if (preferences.length === 0) return true;
  const features = (desk.features || []).map((feature) => String(feature).toLowerCase());
  return preferences.some((pref) => preferenceMatchesDesk(desk, pref, features));
}

function neighborHintForDesk(deskId) {
  if (state.settings.preferredUsers.length === 0) return "";

  const bookings = state.bookings[deskId] || [];
  const preferredMatches = bookings.filter((booking) =>
    state.settings.preferredUsers.includes(booking.email)
  );
  if (preferredMatches.length === 0) return "";

  const labels = preferredMatches.map(
    (b) => `${b.name}${b.slot && b.slot !== "full" ? ` (${b.slot.toUpperCase()})` : ""}`
  );
  return `Preferred teammate booked: ${labels.join(", ")}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isFutureDate(isoDate) {
  return isoDate > todayISO();
}

function selectedDate() {
  return bookingDateInput.value || todayISO();
}

function floorImageFor(floor) {
  return floor === "ground" ? "/floorplans/ground.png" : "/floorplans/first.png";
}

function formatPreference(pref) {
  return String(pref || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function activeUserProfile() {
  const userEmail = (state.user?.email || "").toLowerCase();
  if (!userEmail) return null;
  return state.users.find((user) => (user.email || "").toLowerCase() === userEmail) || null;
}

function getProfilePreferences() {
  const rawPreferences = Array.isArray(state.settings.deskPreferences)
    ? state.settings.deskPreferences
    : [];
  return [...new Set(rawPreferences.map((pref) => String(pref || "").trim().toLowerCase()).filter(Boolean))];
}

function scoreDeskForPreferences(desk, preferences) {
  const slots = desk.slots || {};
  const fullyBooked = Boolean(slots.full) || (slots.am && slots.pm);
  if (fullyBooked) return { score: -1, matched: [] };

  const features = (desk.features || []).map((feature) => String(feature).toLowerCase());
  const matched = preferences.filter((pref) => preferenceMatchesDesk(desk, pref, features));

  let score = 0;
  if (preferences.length > 0) {
    const matchedCount = matched.length;
    const preferenceCoverage = matchedCount / preferences.length;
    score = (matchedCount * 10) + preferenceCoverage;

    // Full matches should always rank above partial matches.
    if (matchedCount === preferences.length) {
      score += 5;
    }
  }

  return { score, matched };
}

function setFloor(floor) {
  state.currentFloor = floor;
  floorImage.src = floorImageFor(floor);

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.floor === floor);
  });

  renderFloorSummary();
}

function rankDesksByHistory() {
  const history = state.userHistory || {};
  const deskWeight = new Map();
  (history.favouriteDesks || []).forEach((d) => deskWeight.set(d.deskId, d.deskDays || 0));
  const zoneWeight = new Map();
  (history.favouriteZones || []).forEach((z) => zoneWeight.set(z.zone, z.deskDays || 0));
  const floorWeight = new Map();
  (history.favouriteFloors || []).forEach((f) => floorWeight.set(f.floor, f.deskDays || 0));

  if (deskWeight.size === 0 && zoneWeight.size === 0 && floorWeight.size === 0) {
    return [];
  }

  const ranked = state.desks
    .map((desk) => {
      const slots = desk.slots || {};
      const fullyBooked = Boolean(slots.full) || (slots.am && slots.pm);
      if (fullyBooked) return null;

      const exact = deskWeight.get(desk.id) || 0;
      const zone = zoneWeight.get(desk.zone) || 0;
      const floor = floorWeight.get(desk.floor) || 0;
      const score = exact * 10 + zone * 2 + floor * 1;
      if (score <= 0) return null;

      const reasons = [];
      if (exact > 0) {
        reasons.push(`booked ${exact} day${exact === 1 ? "" : "s"} recently`);
      } else if (zone > 0) {
        reasons.push(`in ${desk.zone} — where you usually sit`);
      } else if (floor > 0) {
        reasons.push(`on ${formatPreference(desk.floor)} floor — your usual floor`);
      }
      return { desk, score, reasons };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.desk.id.localeCompare(b.desk.id));

  return ranked;
}

function renderHistoryRecommendations(ranked) {
  const visible = ranked.filter(({ desk }) => desk.floor === state.currentFloor);
  const topVisible = visible.slice(0, 3);
  state.recommendedDeskIds = topVisible.map(({ desk }) => desk.id);

  const floorLabel = formatPreference(state.currentFloor);
  recommendationMeta.textContent = `Based on your last 90 days. Showing your top ${topVisible.length} desk${topVisible.length === 1 ? "" : "s"} on ${floorLabel} floor.`;

  if (visible.length === 0) {
    recommendedDeskList.innerHTML = `<li class='muted'>No matching desks on ${floorLabel} floor.</li>`;
    return;
  }

  topVisible.forEach(({ desk, reasons }) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recommendation-item";
    button.addEventListener("click", () => {
      setFloor(desk.floor);
      setSelectedDesk(desk.id);
    });

    const title = createElement("strong", `Desk ${deskLabel(desk.id)}`);
    const detailsText = `${desk.zone} • ${reasons.join(" • ")}`;
    const details = createElement("span", detailsText);
    button.append(title, details);
    item.appendChild(button);
    recommendedDeskList.appendChild(item);
  });
}

function renderRecommendations() {
  if (!recommendedDeskList || !recommendationMeta) return;

  recommendedDeskList.innerHTML = "";
  state.recommendedDeskIds = [];

  const myBookings = userBookingsForCurrentDate();
  if (myBookings.length > 0) {
    const deskIds = [...new Set(myBookings.map((b) => deskLabel(b.deskId)))];
    recommendationMeta.textContent = `You're already booked at desk ${deskIds.join(", ")} for ${selectedDate()}.`;
    return;
  }

  const preferences = getProfilePreferences();
  const hasPreferredUsers = state.settings.preferredUsers.length > 0;

  if (preferences.length === 0) {
    const historyRanked = rankDesksByHistory();
    if (historyRanked.length > 0) {
      renderHistoryRecommendations(historyRanked);
      return;
    }
    if (!hasPreferredUsers) {
      recommendationMeta.textContent = "Set your preferences in Settings to see personalised recommendations.";
      recommendedDeskList.innerHTML = "";
      return;
    }
  }

  if (state.desks.length === 0) {
    recommendationMeta.textContent = "Desk data is loading...";
    recommendedDeskList.innerHTML = "<li class='muted'>Recommendations will appear once desks are loaded.</li>";
    return;
  }

  const hasDeskPreferences = preferences.length > 0;
  const ranked = state.desks
    .map((desk) => ({ desk, ...scoreDeskForPreferences(desk, preferences) }))
    .filter((entry) => entry.score >= 0)
    .filter((entry) => !hasDeskPreferences || entry.matched.length === preferences.length)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.desk.floor !== b.desk.floor) {
        if (a.desk.floor === state.currentFloor) return -1;
        if (b.desk.floor === state.currentFloor) return 1;
      }
      return a.desk.id.localeCompare(b.desk.id);
    });

  const visibleRecommendations = ranked.filter(({ desk }) => desk.floor === state.currentFloor);
  state.recommendedDeskIds = visibleRecommendations
    .filter(({ matched }) => matched.length > 0)
    .map(({ desk }) => desk.id);

  if (ranked.length === 0) {
    if (hasDeskPreferences) {
      recommendationMeta.textContent = "No available desks match your selected preferences.";
      recommendedDeskList.innerHTML = "<li class='muted'>Try changing your preferences or date.</li>";
      return;
    }

    recommendationMeta.textContent = "No available desks right now.";
    recommendedDeskList.innerHTML = "<li class='muted'>All desks are booked for this date.</li>";
    return;
  }

  if (preferences.length === 0) {
    recommendationMeta.textContent = "No profile desk preferences found, showing all available desks.";
  } else {
    const floors = [...new Set(visibleRecommendations.map(({ desk }) => desk.floor))];
    const floorSummary = floors
      .map((floor) => {
        const floorCount = visibleRecommendations.filter(({ desk }) => desk.floor === floor).length;
        return `${formatPreference(floor)}: ${floorCount}`;
      })
      .join(" • ");
    recommendationMeta.textContent = `There are ${ranked.length} available desks matching all selected preferences (${preferences.map(formatPreference).join(", ")}). Showing ${visibleRecommendations.length} on ${formatPreference(state.currentFloor)} floor${floorSummary ? ` (${floorSummary})` : ""}.`;
  }

  if (visibleRecommendations.length === 0) {
    recommendedDeskList.innerHTML = `<li class='muted'>No matching desks on ${formatPreference(state.currentFloor)} floor.</li>`;
    return;
  }

  visibleRecommendations.forEach(({ desk, matched }) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recommendation-item";
    button.addEventListener("click", () => {
      setFloor(desk.floor);
      setSelectedDesk(desk.id);
    });

    const title = createElement("strong", `Desk ${deskLabel(desk.id)}`);
    const matchSummary = hasDeskPreferences
      ? `${matched.length}/${preferences.length} preferences matched`
      : "Available";
    const detailsText = matched.length > 0
      ? `${desk.zone} • ${matchSummary} • ${matched.map(formatPreference).join(", ")}`
      : `${desk.zone} • ${matchSummary}`;
    const details = createElement("span", detailsText);

    button.append(title, details);
    item.appendChild(button);
    recommendedDeskList.appendChild(item);
  });
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return response.json();
}

function getDeskById(deskId) {
  return state.desks.find((desk) => desk.id === deskId);
}

function deskLabel(deskId) {
  return String(deskId || "").toUpperCase();
}

function setSelectedDesk(deskId) {
  state.selectedDeskId = deskId;
  const desk = getDeskById(deskId);
  if (desk) {
    const available = computeAvailableSlots(desk);
    if (available.has("full")) state.selectedSlot = "full";
    else if (available.has("am")) state.selectedSlot = "am";
    else if (available.has("pm")) state.selectedSlot = "pm";
  }
  syncSlotToggle();
  renderSelectedDesk();
  renderDeskPins();
}

function syncSlotToggle() {
  if (!slotToggle) return;
  const desk = getDeskById(state.selectedDeskId);
  const available = desk ? computeAvailableSlots(desk) : new Set(["full", "am", "pm"]);
  slotToggle.querySelectorAll('input[name="slot"]').forEach((input) => {
    const slotAvailable = available.has(input.value);
    input.disabled = !desk || !slotAvailable;
    input.checked = input.value === state.selectedSlot;
    input.parentElement.classList.toggle("disabled", !slotAvailable);
  });
}

function renderSelectedDesk() {
  const desk = getDeskById(state.selectedDeskId);
  if (!desk) {
    selectedDeskCard.classList.add("empty");
    selectedDeskCard.innerHTML = "<p>No desk selected</p>";
    bookButton.disabled = true;
    cancelButton.disabled = true;
    return;
  }

  selectedDeskCard.classList.remove("empty");
  const allAttributes = [...(desk.features || [])];
  if (desk.nearWindow) allAttributes.push("window-seat");
  const features = allAttributes.join(" • ");
  const slots = desk.slots || {};
  const selectedPreferences = getProfilePreferences();
  const userHasDeskPreferences = selectedPreferences.length > 0;
  const deskFeatures = (desk.features || []).map((feature) => String(feature).toLowerCase());
  const matchedPreferences = selectedPreferences.filter((pref) => preferenceMatchesDesk(desk, pref, deskFeatures));
  const prefMatch = userHasDeskPreferences
    ? (matchedPreferences.length === selectedPreferences.length
      ? "Matches all selected desk preferences"
      : matchedPreferences.length > 0
        ? "Matches some selected desk preferences"
        : "Does not match any selected desk preferences")
    : "";
  const neighborHint = neighborHintForDesk(desk.id);
  const occupants = getDeskOccupants(desk);
  let statusText;
  if (slots.full) {
    statusText = `Full day booked by ${slots.full.name}`;
  } else if (slots.am && slots.pm) {
    statusText = `AM: ${slots.am.name} · PM: ${slots.pm.name}`;
  } else if (slots.am) {
    statusText = `AM booked by ${slots.am.name} · PM available`;
  } else if (slots.pm) {
    statusText = `PM booked by ${slots.pm.name} · AM available`;
  } else {
    statusText = "Available now";
  }
  const teamName = activeUserProfile()?.team || "";
  const teammateLine = occupants.some((b) => isTeammateEmail(b.email))
    ? `Same team as you${teamName ? ` (${teamName})` : ""}`
    : "";

  const children = [
    createElement("h4", `Desk ${deskLabel(desk.id)} · ${desk.zone}`),
    createElement("p", features || "No features listed"),
  ];
  const statusLine = createElement("p", statusText);
  if (occupants.length === 0) {
    statusLine.classList.add("availability-status");
  }
  children.push(statusLine);
  if (prefMatch) children.push(createElement("p", prefMatch));
  if (neighborHint) children.push(createElement("p", neighborHint));
  if (teammateLine) children.push(createElement("p", teammateLine));
  selectedDeskCard.replaceChildren(...children);

  const available = computeAvailableSlots(desk);
  bookButton.disabled = !available.has(state.selectedSlot);
  cancelButton.disabled = !getUserBookingOnDesk(desk);
}

function createElement(tag, text) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
}

function renderWeatherPanel() {
  if (!weatherHeadline || !weatherSummary || !weatherDetail || !weatherTemperature || !weatherSource) {
    return;
  }

  const weather = state.weather;
  if (!weather) {
    weatherHeadline.textContent = `Weather unavailable for ${selectedDate()}`;
    weatherSummary.textContent = "We could not load the office forecast right now.";
    weatherDetail.textContent = "Try again after the page finishes loading.";
    weatherTemperature.textContent = "--";
    weatherSource.textContent = "Unavailable";
    weatherIcon?.classList.add("hidden");
    return;
  }

  const temperature = Number(weather.temperature);
  const hasTemperature = Number.isFinite(temperature);
  const formattedTemperature = hasTemperature ? `${Math.round(temperature)}°C` : "--";
  const headline = weather.mode === "future"
    ? `Forecast for ${weather.date}`
    : weather.mode === "forecast"
      ? `Short-range forecast for ${weather.date}`
      : `Current weather for ${weather.date}`;

  weatherHeadline.textContent = headline;
  weatherSummary.textContent = `${weather.location} · ${weather.condition}`;

  if (weather.mode === "future" || weather.mode === "forecast") {
    const high = Number.isFinite(Number(weather.highTemperature)) ? `${Math.round(Number(weather.highTemperature))}°C` : "--";
    const low = Number.isFinite(Number(weather.lowTemperature)) ? `${Math.round(Number(weather.lowTemperature))}°C` : "--";
    const humidity = weather.humidity === null || weather.humidity === undefined ? "" : ` · Humidity ${weather.humidity}%`;
    const rainChance = weather.chanceOfRain === null || weather.chanceOfRain === undefined || weather.chanceOfRain === ""
      ? ""
      : ` · ${weather.chanceOfRain}% chance of rain`;
    weatherDetail.textContent = `Average ${formattedTemperature} · High ${high} · Low ${low}${humidity}${rainChance}`;
    weatherSource.textContent = weather.mode === "forecast" ? "Short-range forecast" : "Future forecast";
  } else {
    const feelsLike = Number.isFinite(Number(weather.feelsLike)) ? `${Math.round(Number(weather.feelsLike))}°C` : "--";
    const humidity = weather.humidity === null || weather.humidity === undefined ? "--" : `${weather.humidity}%`;
    const windKph = weather.windKph === null || weather.windKph === undefined ? "--" : `${weather.windKph} kph`;
    weatherDetail.textContent = `Feels like ${feelsLike} · Humidity ${humidity} · Wind ${windKph}`;
    weatherSource.textContent = "Current conditions";
  }

  weatherTemperature.textContent = formattedTemperature;
  if (weatherIcon) {
    if (weather.icon) {
      weatherIcon.src = weather.icon.startsWith("//") ? `https:${weather.icon}` : weather.icon;
      weatherIcon.alt = weather.condition || "Weather icon";
      weatherIcon.classList.remove("hidden");
    } else {
      weatherIcon.classList.add("hidden");
    }
  }
}

async function loadWeather() {
  if (!weatherHeadline) return;

  const date = selectedDate();
  weatherHeadline.textContent = isFutureDate(date) ? `Loading forecast for ${date}...` : `Loading weather for ${date}...`;
  weatherSummary.textContent = "Fetching the latest office conditions.";
  weatherDetail.textContent = "Please wait while we load the forecast.";
  weatherTemperature.textContent = "--";
  weatherSource.textContent = "Loading";
  weatherIcon?.classList.add("hidden");

  try {
    state.weather = await fetchJSON(`/api/weather?date=${encodeURIComponent(date)}`);
  } catch (error) {
    state.weather = null;
    weatherHeadline.textContent = `Weather unavailable for ${date}`;
    weatherSummary.textContent = error.message;
    weatherDetail.textContent = "The office weather service could not be reached.";
    weatherTemperature.textContent = "--";
    weatherSource.textContent = "Unavailable";
    weatherIcon?.classList.add("hidden");
    return;
  }

  renderWeatherPanel();
}

function renderUserSwitchOptions() {
  if (!userSwitchSelect) return;

  userSwitchSelect.innerHTML = "";
  if (state.users.length === 0) {
    userSwitchSelect.appendChild(createElement("option", "No users available"));
    userSwitchSelect.disabled = true;
    return;
  }

  const currentEmail = (state.user?.email || "").toLowerCase();
  const sortedUsers = [...state.users].sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
  sortedUsers.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.email || "";
    const label = user.fullName || user.email || "Unknown user";
    option.textContent = user.team ? `${label} (${user.team})` : label;
    if ((user.email || "").toLowerCase() === currentEmail) {
      option.selected = true;
    }
    userSwitchSelect.appendChild(option);
  });
  userSwitchSelect.disabled = false;
}

async function switchActiveUser(email) {
  await fetchJSON("/api/switch-user", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  await loadMe();
  await loadUsers();
  await refreshSettingsFromDb();
  await loadUserHistory();
  await loadDesksAndBookings();
  if (state.currentView === "reports") {
    loadReports();
  }
}

function renderFloorSummary() {
  const visibleDesks = state.desks.filter((desk) => desk.floor === state.currentFloor);
  const available = visibleDesks.filter((desk) => desk.available).length;
  floorSummary.textContent = `${available} of ${visibleDesks.length} desks available on ${state.currentFloor} floor for ${selectedDate()}.`;
}

function renderBookingList() {
  bookingList.innerHTML = "";

  const flat = [];
  Object.entries(state.bookings).forEach(([deskId, bookings]) => {
    (bookings || []).forEach((booking) => flat.push({ deskId, booking }));
  });

  if (flat.length === 0) {
    bookingList.innerHTML = "<li class='muted'>No bookings yet for this day.</li>";
    return;
  }

  const slotOrder = { full: 0, am: 1, pm: 2 };
  flat
    .sort((a, b) => {
      const byDesk = a.deskId.localeCompare(b.deskId);
      if (byDesk !== 0) return byDesk;
      return (slotOrder[a.booking.slot] || 0) - (slotOrder[b.booking.slot] || 0);
    })
    .forEach(({ deskId, booking }) => {
      const li = document.createElement("li");

      const isPreferredUser = state.settings.preferredUsers.includes(booking.email);
      const isTeammate = isTeammateEmail(booking.email);

      if (isPreferredUser) li.classList.add("booking-preferred-user");
      if (isTeammate && !isPreferredUser) li.classList.add("booking-teammate");

      const slotLabel = booking.slot === "am"
        ? " · AM"
        : booking.slot === "pm"
          ? " · PM"
          : " · Full";
      li.append(
        createElement("strong", `${deskLabel(deskId)}${slotLabel}`),
        createElement("span", booking.name)
      );

      if (isTeammate) {
        const indicator = document.createElement("span");
        indicator.className = "teammate-indicator";
        indicator.setAttribute("aria-label", "same team");
        indicator.textContent = "👥";
        li.appendChild(indicator);
      }
      if (isPreferredUser) {
        const indicator = document.createElement("span");
        indicator.className = "preferred-indicator";
        indicator.setAttribute("aria-label", "preferred colleague");
        indicator.textContent = "⭐";
        li.appendChild(indicator);
      }

      bookingList.appendChild(li);
    });
}

function renderOfficeBusyness() {
  if (!officeBusyMeta) return;

  if (!state.busyness) {
    officeBusyMeta.textContent = "Unable to estimate office busyness right now.";
    return;
  }

  const {
    band,
    predictedOccupancyCount,
    predictedOccupancyPct,
    totalDesks,
    anchorMatchedUsers,
    bookedCount,
  } = state.busyness;

  officeBusyMeta.textContent = `${band} expected: about ${predictedOccupancyCount}/${totalDesks} desks (${predictedOccupancyPct}%) for ${selectedDate()}. Based on ${anchorMatchedUsers} users with this anchor-day pattern and ${bookedCount} desks already booked.`;
}

function tintForBooking(booking) {
  if (!booking) return null;
  const email = booking.email;
  if (email && state.settings.preferredUsers.includes(email)) return "preferred";
  if (email && isTeammateEmail(email)) return "teammate";
  return "booked";
}

function renderDeskPins() {
  deskLayer.innerHTML = "";
  const recommendedDeskIds = new Set(state.recommendedDeskIds);
  const visibleDesks = state.desks.filter((desk) => desk.floor === state.currentFloor);

  visibleDesks.forEach((desk) => {
    const pin = pinTemplate.content.firstElementChild.cloneNode(true);
    pin.style.left = `${desk.x}%`;
    pin.style.top = `${desk.y}%`;
    pin.dataset.deskId = desk.id;
    const isRecommended = recommendedDeskIds.has(desk.id);

    const slots = desk.slots || {};
    const fullTaken = Boolean(slots.full);
    const amTaken = Boolean(slots.am);
    const pmTaken = Boolean(slots.pm);
    const fullyBooked = fullTaken || (amTaken && pmTaken);
    const halfAm = amTaken && !pmTaken && !fullTaken;
    const halfPm = pmTaken && !amTaken && !fullTaken;

    const amTint = amTaken ? tintForBooking(slots.am) : null;
    const pmTint = pmTaken ? tintForBooking(slots.pm) : null;
    const fullTint = fullTaken ? tintForBooking(slots.full) : null;
    const primaryTint = fullTint || amTint || pmTint;

    const isBookedByPreferredUser = primaryTint === "preferred";
    const isBookedByTeammate = primaryTint === "teammate";

    pin.classList.toggle("available", !fullyBooked && !halfAm && !halfPm);
    pin.classList.toggle("booked", fullyBooked);
    pin.classList.toggle("half-am-booked", halfAm);
    pin.classList.toggle("half-pm-booked", halfPm);
    pin.classList.toggle("selected", state.selectedDeskId === desk.id);
    pin.classList.toggle("recommended", isRecommended);
    pin.classList.toggle("pref-mismatch", !isRecommended && !deskMatchesPreferences(desk));
    pin.classList.toggle("booked-by-teammate", fullyBooked && isBookedByTeammate && !isBookedByPreferredUser);
    pin.classList.toggle("booked-by-preferred", fullyBooked && isBookedByPreferredUser);

    if (fullTaken) {
      pin.dataset.amTint = fullTint;
      pin.dataset.pmTint = fullTint;
    } else {
      if (amTint) pin.dataset.amTint = amTint; else delete pin.dataset.amTint;
      if (pmTint) pin.dataset.pmTint = pmTint; else delete pin.dataset.pmTint;
    }

    let statusGlyph;
    if (fullyBooked) {
      statusGlyph = isBookedByPreferredUser ? "♥" : isBookedByTeammate ? "⚑" : "✕";
    } else if (halfAm) {
      statusGlyph = "◐";
    } else if (halfPm) {
      statusGlyph = "◑";
    } else if (isRecommended) {
      statusGlyph = "★";
    } else {
      statusGlyph = "✓";
    }
    pin.textContent = `${deskLabel(desk.id)} ${statusGlyph}`;

    if (fullTaken) {
      pin.title = `Desk ${deskLabel(desk.id)} fully booked`;
    } else if (amTaken && pmTaken) {
      pin.title = `Desk ${deskLabel(desk.id)} AM + PM both booked`;
    } else if (halfAm) {
      pin.title = `Desk ${deskLabel(desk.id)} AM booked, PM free`;
    } else if (halfPm) {
      pin.title = `Desk ${deskLabel(desk.id)} PM booked, AM free`;
    } else {
      pin.title = `Desk ${deskLabel(desk.id)} available`;
    }
    pin.addEventListener("click", () => setSelectedDesk(desk.id));
    deskLayer.appendChild(pin);
  });
}

async function loadMe() {
  const payload = await fetchJSON("/api/me");
  state.user = payload.user;
  userBadge.textContent = `${state.user.name} (${state.user.source})`;

  const isAuthenticated = Boolean(payload.authenticated);
  signInButton?.classList.toggle("hidden", isAuthenticated);
  signOutButton?.classList.toggle("hidden", !isAuthenticated);
}

async function loadUsers() {
  const users = await fetchJSON("/api/users");
  state.users = Array.isArray(users) ? users : [];
  renderUserSwitchOptions();
  renderSelectedPreferredUsers();
  renderPreferredUserResults(preferredUserSearch?.value || "");
  renderRecommendations();
}

async function loadDesksAndBookings() {
  const date = selectedDate();
  const [deskPayload, bookingPayload, busynessPayload] = await Promise.all([
    fetchJSON(`/api/desks?date=${encodeURIComponent(date)}`),
    fetchJSON(`/api/bookings?date=${encodeURIComponent(date)}`),
    fetchJSON(`/api/office-busyness?date=${encodeURIComponent(date)}`),
  ]);

  state.desks = deskPayload.desks;
  state.bookings = bookingPayload.bookings || {};
  state.busyness = busynessPayload || null;

  if (state.selectedDeskId) {
    const selectedExists = state.desks.some((desk) => desk.id === state.selectedDeskId);
    if (!selectedExists) {
      state.selectedDeskId = null;
    }
  }

  renderRecommendations();
  renderDeskPins();
  renderFloorSummary();
  renderOfficeBusyness();
  syncSlotToggle();
  renderSelectedDesk();
  renderBookingList();
  syncReleaseDeskButton();
  syncExtendStayButton();
  await loadWeather();
}

async function createBooking() {
  if (!state.selectedDeskId) return;

  try {
    await fetchJSON("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        deskId: state.selectedDeskId,
        date: selectedDate(),
        slot: state.selectedSlot,
      }),
    });
    await loadDesksAndBookings();
  } catch (error) {
    window.alert(error.message);
  }
}

function userBookingsForCurrentDate() {
  const myEmail = (state.user?.email || "").toLowerCase();
  if (!myEmail) return [];
  const result = [];
  Object.entries(state.bookings).forEach(([deskId, bookings]) => {
    (bookings || []).forEach((booking) => {
      if (String(booking.email || "").toLowerCase() === myEmail) {
        result.push({ deskId, slot: booking.slot || "full" });
      }
    });
  });
  return result;
}

function syncReleaseDeskButton() {
  if (!releaseDeskButton) return;
  const mine = userBookingsForCurrentDate();
  releaseDeskButton.disabled = mine.length === 0;
  releaseDeskButton.title = mine.length === 0
    ? "You have no bookings to release for this day"
    : `Release ${mine.length} booking${mine.length === 1 ? "" : "s"} for ${selectedDate()}`;
}

function extendableHalfBookings() {
  const myEmail = (state.user?.email || "").toLowerCase();
  if (!myEmail) return [];
  const opposite = { am: "pm", pm: "am" };
  const result = [];
  Object.entries(state.bookings).forEach(([deskId, bookings]) => {
    const list = bookings || [];
    const slotMap = {};
    list.forEach((b) => { slotMap[b.slot] = b; });
    if (slotMap.full) return;
    ["am", "pm"].forEach((slot) => {
      const mine = slotMap[slot];
      if (!mine) return;
      if (String(mine.email || "").toLowerCase() !== myEmail) return;
      if (slotMap[opposite[slot]]) return;
      result.push({ deskId, fromSlot: slot, toSlot: opposite[slot] });
    });
  });
  return result;
}

function syncExtendStayButton() {
  if (!extendStayButton) return;
  const eligible = extendableHalfBookings();
  extendStayButton.classList.toggle("hidden", eligible.length === 0);
  if (eligible.length > 0) {
    extendStayButton.title = `Extend ${eligible.length} half-day booking${
      eligible.length === 1 ? "" : "s"
    } to full day`;
  }
}

async function extendMyStay() {
  const eligible = extendableHalfBookings();
  if (eligible.length === 0) return;

  const summary = eligible
    .map((e) => `${e.deskId} (${e.fromSlot.toUpperCase()} → +${e.toSlot.toUpperCase()})`)
    .join(", ");
  if (!window.confirm(`Extend to full day for ${selectedDate()}: ${summary}?`)) return;

  try {
    const result = await fetchJSON(
      `/api/bookings/extend?date=${encodeURIComponent(selectedDate())}`,
      { method: "POST" }
    );
    await loadDesksAndBookings();
    if (result && typeof result.count === "number" && result.count < eligible.length) {
      window.alert(
        `Extended ${result.count} of ${eligible.length} bookings. Some slots were taken before the request completed.`
      );
    }
  } catch (error) {
    window.alert(error.message);
  }
}

async function releaseMyDesks() {
  const mine = userBookingsForCurrentDate();
  if (mine.length === 0) return;

  const confirmMsg = `Release all ${mine.length} of your bookings for ${selectedDate()}?`;
  if (!window.confirm(confirmMsg)) return;

  try {
    await fetchJSON(
      `/api/bookings/mine?date=${encodeURIComponent(selectedDate())}`,
      { method: "DELETE" }
    );
    await loadDesksAndBookings();
  } catch (error) {
    window.alert(error.message);
  }
}

async function cancelBooking() {
  if (!state.selectedDeskId) return;
  const desk = getDeskById(state.selectedDeskId);
  const ownBooking = desk ? getUserBookingOnDesk(desk) : null;
  if (!ownBooking) {
    window.alert("You don't have a booking on this desk.");
    return;
  }

  try {
    await fetchJSON(
      `/api/bookings/${encodeURIComponent(state.selectedDeskId)}` +
        `?date=${encodeURIComponent(selectedDate())}` +
        `&slot=${encodeURIComponent(ownBooking.slot || "full")}`,
      { method: "DELETE" }
    );
    await loadDesksAndBookings();
  } catch (error) {
    window.alert(error.message);
  }
}

async function loadReports() {
  const days = reportsWindowSelect ? Number(reportsWindowSelect.value) || 30 : 30;
  if (reportsMeta) reportsMeta.textContent = `Loading the last ${days} days...`;

  try {
    const payload = await fetchJSON(`/api/reports?days=${days}`);
    renderReports(payload);
  } catch (error) {
    if (reportsMeta) reportsMeta.textContent = `Unable to load reports: ${error.message}`;
  }
}

function renderReports(data) {
  if (!data) return;

  const range = data.range || {};
  const title = document.getElementById("reportsTitle");
  if (title) {
    const name = data.user?.name || "Your";
    title.textContent = `${name}'s usage`;
  }
  if (reportsMeta) {
    reportsMeta.textContent = `${range.start} → ${range.end} · ${range.weekdaysInWindow} weekdays in window`;
  }

  renderReportStats(data.summary || {}, range);
  renderFavouriteDesks(data.favouriteDesks || []);
  renderSlotSplit(data.slotSplit || { full: 0, am: 0, pm: 0 });
  renderFloorZone(data.byFloor || [], data.byZone || []);
  renderWeekdayPattern(data.weekdayPattern || []);
  renderAnchorAdherence(data.anchorAdherence || { configured: false });
  renderCoLocation(data.coLocation || { configured: false, perUser: [] });
}

function renderReportStats(summary, range) {
  const container = document.getElementById("reportStats");
  if (!container) return;
  container.innerHTML = "";

  const stats = [
    {
      label: "Days in office",
      value: summary.totalDays ?? 0,
      sub: `${summary.fullDays ?? 0} full-day · ${summary.halfDays ?? 0} half-day bookings`,
      tone: "brand",
    },
    {
      label: "Attendance",
      value: `${summary.attendancePct ?? 0}%`,
      sub: `of ${range.weekdaysInWindow ?? 0} weekdays`,
      tone: attendanceTone(summary.attendancePct),
    },
    {
      label: "Desk-days booked",
      value: summary.deskDays ?? 0,
      sub: `${summary.totalBookings ?? 0} bookings total`,
      tone: "neutral",
    },
  ];

  stats.forEach((stat) => {
    const card = document.createElement("div");
    card.className = `stat-card tone-${stat.tone}`;
    card.append(
      createElement("span", stat.label),
      createElement("strong", String(stat.value)),
      createElement("small", stat.sub)
    );
    card.querySelector("span").className = "stat-label";
    card.querySelector("small").className = "stat-sub";
    container.appendChild(card);
  });
}

function attendanceTone(pct) {
  if (pct === undefined || pct === null) return "neutral";
  if (pct >= 60) return "good";
  if (pct >= 30) return "warn";
  return "neutral";
}

function renderFavouriteDesks(desks) {
  const container = document.getElementById("reportFavouriteDesks");
  if (!container) return;
  container.innerHTML = "";
  if (desks.length === 0) {
    container.innerHTML = "<p class='muted'>No desks booked in this window.</p>";
    return;
  }
  const top = desks.slice(0, 5);
  const max = Math.max(...top.map((d) => d.deskDays), 0.5);
  top.forEach((desk, index) => {
    const row = document.createElement("div");
    row.className = "desk-row";
    const rank = createElement("span", `#${index + 1}`);
    rank.className = "desk-rank";
    const body = document.createElement("div");
    body.className = "desk-body";
    body.append(
      createElement("strong", `Desk ${desk.deskId.toUpperCase()}`),
      createElement("span", `${formatPreference(desk.floor)} · ${desk.zone}`)
    );
    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill brand";
    fill.style.width = `${(desk.deskDays / max) * 100}%`;
    track.appendChild(fill);
    const value = createElement("span", `${desk.deskDays} day${desk.deskDays === 1 ? "" : "s"}`);
    value.className = "desk-value";
    row.append(rank, body, track, value);
    container.appendChild(row);
  });
}

function renderSlotSplit(split) {
  const container = document.getElementById("reportSlotSplit");
  if (!container) return;
  const total = (split.full || 0) + (split.am || 0) + (split.pm || 0);
  container.innerHTML = "";
  if (total === 0) {
    container.innerHTML = "<p class='muted'>No bookings in this window.</p>";
    return;
  }

  const items = [
    { key: "full", label: "Full day", count: split.full || 0 },
    { key: "am", label: "AM only", count: split.am || 0 },
    { key: "pm", label: "PM only", count: split.pm || 0 },
  ];
  items.forEach((item) => {
    const pct = Math.round((item.count / total) * 100);
    const row = document.createElement("div");
    row.className = "bar-row";
    const label = createElement("span", item.label);
    label.className = "bar-label";
    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = `bar-fill slot-${item.key}`;
    fill.style.width = `${pct}%`;
    track.appendChild(fill);
    const value = createElement("span", `${item.count} · ${pct}%`);
    value.className = "bar-value";
    row.append(label, track, value);
    container.appendChild(row);
  });
}

function renderFloorZone(floors, zones) {
  const container = document.getElementById("reportFloorZone");
  if (!container) return;
  container.innerHTML = "";

  const renderGroup = (title, items, key) => {
    const wrap = document.createElement("div");
    wrap.className = "dual-list-group";
    wrap.appendChild(createElement("h4", title));
    if (items.length === 0) {
      const empty = createElement("p", "No data");
      empty.className = "muted";
      wrap.appendChild(empty);
      return wrap;
    }
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      const label = createElement("span", formatPreference(item[key]));
      label.className = "bar-label";
      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = "bar-fill brand";
      fill.style.width = `${item.pct}%`;
      track.appendChild(fill);
      const value = createElement("span", `${item.pct}%`);
      value.className = "bar-value";
      row.append(label, track, value);
      wrap.appendChild(row);
    });
    return wrap;
  };

  container.append(renderGroup("Floor", floors, "floor"), renderGroup("Zone", zones, "zone"));
}

function renderWeekdayPattern(days) {
  const container = document.getElementById("reportWeekday");
  if (!container) return;
  container.innerHTML = "";
  const max = Math.max(...days.map((d) => d.days), 1);
  days.forEach((day) => {
    const col = document.createElement("div");
    col.className = "weekday-col";
    const bar = document.createElement("div");
    bar.className = "weekday-bar";
    const fill = document.createElement("div");
    fill.className = "weekday-fill";
    fill.style.height = `${(day.days / max) * 100}%`;
    if (day.days === 0) fill.classList.add("empty");
    bar.appendChild(fill);
    col.append(
      createElement("strong", String(day.days)),
      bar,
      createElement("span", day.label.slice(0, 3))
    );
    container.appendChild(col);
  });
}

function renderAnchorAdherence(anchor) {
  const container = document.getElementById("reportAnchor");
  const hint = document.getElementById("anchorHint");
  if (!container) return;
  container.innerHTML = "";

  if (!anchor.configured) {
    if (hint) hint.textContent = "Set anchor days in User Settings to see how well you stick to them.";
    container.innerHTML = "<p class='muted'>No anchor days configured.</p>";
    return;
  }

  if (hint) {
    hint.textContent = `Your anchor days: ${(anchor.anchorLabels || []).join(", ") || "—"}`;
  }

  const ring = document.createElement("div");
  ring.className = "anchor-ring";
  ring.style.setProperty("--pct", anchor.pct);
  ring.append(
    createElement("strong", `${anchor.pct}%`),
    createElement("span", "on anchor")
  );

  const stats = document.createElement("div");
  stats.className = "anchor-stats";
  const items = [
    { label: "On anchor", value: anchor.onAnchor, tone: "good" },
    { label: "Off anchor", value: anchor.offAnchor, tone: "warn" },
    { label: "Missed anchor", value: anchor.missedAnchor, tone: "muted" },
  ];
  items.forEach((item) => {
    const pill = document.createElement("div");
    pill.className = `anchor-pill tone-${item.tone}`;
    pill.append(createElement("strong", String(item.value)), createElement("span", item.label));
    stats.appendChild(pill);
  });

  container.append(ring, stats);
}

function renderCoLocation(co) {
  const container = document.getElementById("reportCoLocation");
  const hint = document.getElementById("coLocationHint");
  if (!container) return;
  container.innerHTML = "";

  if (!co.configured) {
    if (hint) hint.textContent = "Add preferred colleagues in User Settings to track how often you sit together.";
    container.innerHTML = "<p class='muted'>No preferred colleagues configured.</p>";
    return;
  }

  if (co.totals && co.totals.sharedDays === 0) {
    container.innerHTML = "<p class='muted'>You and your preferred colleagues haven't overlapped in office yet.</p>";
    return;
  }

  co.perUser.forEach((row) => {
    const card = document.createElement("div");
    card.className = "co-row";
    const left = document.createElement("div");
    left.className = "co-name";
    left.append(
      createElement("strong", row.name),
      createElement("span", row.team || "—")
    );
    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill brand";
    fill.style.width = `${row.pct}%`;
    track.appendChild(fill);
    const value = createElement("span", `${row.coLocatedDays}/${row.sharedDays} · ${row.pct}%`);
    value.className = "co-value";
    card.append(left, track, value);
    container.appendChild(card);
  });
}

function bindEvents() {
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const viewName = button.dataset.view;

      if (viewName === "settings") {
        try {
          await refreshSettingsFromDb();
        } catch (error) {
          window.alert(error.message);
          return;
        }
      }

      if (viewName === "reports") {
        switchView(viewName);
        loadReports();
        return;
      }

      switchView(viewName);
    });
  });

  if (reportsWindowSelect) {
    reportsWindowSelect.addEventListener("change", () => loadReports());
  }

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      setFloor(button.dataset.floor);
      renderRecommendations();
      renderDeskPins();
    });
  });

  bookingDateInput.addEventListener("change", loadDesksAndBookings);
  bookButton.addEventListener("click", createBooking);
  cancelButton.addEventListener("click", cancelBooking);

  if (slotToggle) {
    slotToggle.addEventListener("change", (event) => {
      if (event.target?.name !== "slot") return;
      state.selectedSlot = event.target.value;
      renderSelectedDesk();
    });
  }

  if (releaseDeskButton) {
    releaseDeskButton.addEventListener("click", releaseMyDesks);
  }

  if (extendStayButton) {
    extendStayButton.addEventListener("click", extendMyStay);
  }

  if (userSwitchSelect) {
    userSwitchSelect.addEventListener("change", async (event) => {
      const selectedEmail = String(event.target.value || "").trim().toLowerCase();
      if (!selectedEmail) return;
      if ((state.user?.email || "").toLowerCase() === selectedEmail) return;

      userSwitchSelect.disabled = true;
      try {
        await switchActiveUser(selectedEmail);
      } catch (error) {
        window.alert(error.message);
        renderUserSwitchOptions();
      } finally {
        userSwitchSelect.disabled = false;
      }
    });
  }

  if (settingsForm) {
    settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const selectedPreferences = Array.from(
      settingsForm.querySelectorAll('input[name="deskPreferences"]:checked')
    ).map((input) => input.value);
    const selectedAnchorDays = Array.from(
      settingsForm.querySelectorAll('input[name="anchorDays"]:checked')
    ).map((input) => input.value);

    state.settings = {
      deskPreferences: selectedPreferences,
      preferredUsers: [...state.settings.preferredUsers],
      anchorDays: selectedAnchorDays,
    };

    let savePayload;
    try {
      savePayload = await saveSettings();
    } catch (error) {
      window.alert(error.message);
      return;
    }

    await loadDesksAndBookings();
    const ignoredPreferences = Array.isArray(savePayload?.ignoredPreferences)
      ? savePayload.ignoredPreferences
      : [];
    if (ignoredPreferences.length > 0) {
      window.alert(`Settings saved. Some preferences are not available right now: ${ignoredPreferences.join(", ")}.`);
      return;
    }
    window.alert("Settings saved.");
  });
  }

  if (preferredUserSearch) {
    preferredUserSearch.addEventListener("input", (event) => {
      renderPreferredUserResults(event.target.value);
    });

    preferredUserSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const firstResult = preferredUserResults?.querySelector(".person-option");
        if (firstResult) {
          firstResult.click();
        }
      }
    });
  }

  if (resetSettingsButton) {
    resetSettingsButton.addEventListener("click", async () => {
      state.settings = { deskPreferences: [], preferredUsers: [], anchorDays: [] };
      try {
        await saveSettings();
      } catch (error) {
        window.alert(error.message);
        return;
      }

      hydrateSettingsForm();
      await loadDesksAndBookings();
    });
  }
}

function ensureRequiredElements() {
  const required = {
    bookingDateInput, floorImage, deskLayer, floorSummary,
    selectedDeskCard, bookButton, cancelButton, bookingList,
    officeBusyMeta, recommendationMeta, recommendedDeskList,
    userBadge, pinTemplate, slotToggle,
  };
  const missing = Object.entries(required)
    .filter(([, el]) => !el)
    .map(([name]) => name);
  if (missing.length > 0) {
    console.error(
      `Find My Desk: required DOM elements missing — ${missing.join(", ")}. UI initialization aborted.`
    );
    return false;
  }
  return true;
}

async function init() {
  if (!ensureRequiredElements()) return;

  const initialView = document.body.dataset.initialView || "bookings";
  bookingDateInput.value = todayISO();
  bindEvents();
  syncSlotToggle();
  switchView(initialView);

  try {
    await loadMe();
    await loadUsers();
    await refreshSettingsFromDb();
    await loadUserHistory();
    await loadDesksAndBookings();
    if (initialView === "reports") {
      loadReports();
    }
  } catch (error) {
    console.error(error);
    floorSummary.textContent = "Unable to load desk data right now.";
  }
}

init();