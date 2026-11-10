// Card texts (Italian + English). Entity states are formatted by Home Assistant (hass.formatEntityState),
// so the station status uses the integration's own translations.

const it = {
  power: "Potenza",
  energy: "Energia erogata",
  duration: "Durata",
  hoursMinutes: "h:min",
  maxAvailable: "Max disponibile",
  limit: "Limite",
  start: "Avvia",
  pause: "Pausa",
  resume: "Riprendi",
  stop: "Ferma",
  curve: "Curva di potenza",
  curveEmpty: "Nessuna ricarica in corso",
  lastCharge: "Ultima ricarica",
  saving: "risparmio",
  pickStation: "Scegli una colonnina Wallbox WEB nell'editor della card.",
  notFound: "Colonnina non trovata: controlla l'integrazione Wallbox WEB.",
  offline: "Non raggiungibile",
  error: "Errore",
  // editor
  device_id: "Colonnina",
  name: "Nome (facoltativo)",
  show_curve: "Curva di potenza",
  show_actions: "Pulsanti di comando",
  show_last_charge: "Ultima ricarica",
  curve_hours: "Ore di storico per la curva",
  appearance: "Aspetto",
  appearanceApp: "Wallbox WEB (scuro, vetro)",
  appearanceTheme: "Tema di Home Assistant",
  commandFailed: "Comando non riuscito",
};

const en: typeof it = {
  power: "Power",
  energy: "Energy delivered",
  duration: "Duration",
  hoursMinutes: "h:min",
  maxAvailable: "Max available",
  limit: "Limit",
  start: "Start",
  pause: "Pause",
  resume: "Resume",
  stop: "Stop",
  curve: "Power curve",
  curveEmpty: "No charge in progress",
  lastCharge: "Last charge",
  saving: "saved",
  pickStation: "Pick a Wallbox WEB station in the card editor.",
  notFound: "Station not found: check the Wallbox WEB integration.",
  offline: "Unreachable",
  error: "Error",
  device_id: "Station",
  name: "Name (optional)",
  show_curve: "Power curve",
  show_actions: "Command buttons",
  show_last_charge: "Last charge",
  curve_hours: "Hours of history for the curve",
  appearance: "Appearance",
  appearanceApp: "Wallbox WEB (dark, glass)",
  appearanceTheme: "Home Assistant theme",
  commandFailed: "Command failed",
};

export type Strings = typeof it;

export function strings(language: string | undefined): Strings {
  return (language ?? "").toLowerCase().startsWith("it") ? it : en;
}
