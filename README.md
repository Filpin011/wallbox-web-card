# Wallbox WEB card

[![Apri in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Filpin011&repository=wallbox-web-card&category=plugin)
[![CI](https://github.com/Filpin011/wallbox-web-card/actions/workflows/ci.yml/badge.svg)](https://github.com/Filpin011/wallbox-web-card/actions/workflows/ci.yml)
[![Validate](https://github.com/Filpin011/wallbox-web-card/actions/workflows/validate.yml/badge.svg)](https://github.com/Filpin011/wallbox-web-card/actions/workflows/validate.yml)

> **Progetto indipendente e non ufficiale.** Nato dallo studio di come le colonnine comunicano sulla rete locale
> (interoperabilità). **Non è affiliato, approvato né supportato da SCAME PARRE S.p.A.** "Scame" e i marchi
> collegati appartengono ai rispettivi titolari e sono citati solo per indicare i dispositivi compatibili. Nessuna
> garanzia: la usi a tuo rischio. Dettagli: [DISCLAIMER.md](DISCLAIMER.md).

Card per le dashboard di Home Assistant con l'aspetto della schermata **Stato** dell'app Wallbox WEB (scura,
Liquid Glass): banda di stato con pillola della modalità, indicatore di potenza a semicerchio con bagliore e limite,
riquadri Energia e Durata, pulsanti in vetro **Avvia / Pausa / Riprendi / Ferma**, mini curva della potenza della
ricarica in corso e ultima ricarica con costo e risparmio.

![Wallbox WEB card](docs/screenshot.png)

## Requisiti

- Home Assistant **2026.11** o successivo.
- L'integrazione **[Wallbox WEB](https://github.com/Filpin011/ha-wallbox-web)** configurata: la card legge le sue
  entità e preme i suoi pulsanti.

## Installazione

### Con HACS (consigliato)

1. Premi **Apri in HACS** qui sopra, oppure HACS › ⋮ › **Repository personalizzati** › URL
   `https://github.com/Filpin011/wallbox-web-card`, tipo **Dashboard**.
2. **Scarica**. HACS aggiunge da solo la risorsa della dashboard.
3. Ricarica la pagina del browser (o chiudi e riapri l'app Companion).

### Manuale (Samba / File editor)

1. Scarica `wallbox-web-card.js` dall'ultima [release](https://github.com/Filpin011/wallbox-web-card/releases) e
   copialo in `/config/www/wallbox-web-card.js` (Samba: `\\homeassistant\config\www\`).
2. Impostazioni › Dashboard › ⋮ › **Risorse** › **Aggiungi risorsa**: URL `/local/wallbox-web-card.js?v=0.1.0`,
   tipo **Modulo JavaScript** (serve la *Modalità avanzata* nel profilo utente). Cambia `?v=` a ogni aggiornamento.
3. Ricarica la pagina.

## Uso

Modifica dashboard › **Aggiungi card** › cerca **Wallbox WEB** › scegli la **colonnina** nell'editor visuale.
La card compare anche tra i suggerimenti quando scegli l'entità *Stato* di una colonnina.

```yaml
type: custom:wallbox-web-card
device_id: 0123456789abcdef0123456789abcdef  # scelto dall'editor
name: Garage            # facoltativo (default: nome del dispositivo)
show_actions: true      # pulsanti di comando
show_curve: true        # curva di potenza
show_last_charge: true  # ultima ricarica con costo e risparmio
curve_hours: 6          # ore di storico se il server non fornisce la curva della ricarica
appearance: app         # app = aspetto Wallbox WEB (scuro); theme = colori del tema di Home Assistant
```

| Opzione | Default | Descrizione |
|---|---|---|
| `device_id` | – | dispositivo della colonnina (integrazione Wallbox WEB), obbligatorio |
| `name` | nome del dispositivo | testo sopra lo stato |
| `show_actions` | `true` | Avvia / Pausa / Riprendi / Ferma (solo i comandi possibili; nascosti se il token è di sola lettura) |
| `show_curve` | `true` | curva della ricarica in corso (registratore del server) o storico del sensore Potenza |
| `show_last_charge` | `true` | energia, costo e risparmio dell'ultima ricarica |
| `curve_hours` | `6` | finestra dello storico per la curva |
| `appearance` | `app` | `app` o `theme` |

Tocca la banda di stato, l'indicatore o i riquadri per aprire i dettagli dell'entità. I colori si possono cambiare
da un tema di Home Assistant: `wallbox-accent`, `wallbox-info`, `wallbox-warning`, `wallbox-fault`,
`wallbox-danger`, `wallbox-bg`, `wallbox-surface`, `wallbox-text`.

Rispetta *Riduci movimento* e *Riduci trasparenza* del sistema.

---

## English (short)

> **Independent, unofficial project**, based on a study of how the stations communicate on the local network.
> **Not affiliated with, endorsed or supported by SCAME PARRE S.p.A.**; trademarks belong to their owners and are
> used only to identify compatible devices. No warranty. See [DISCLAIMER.md](DISCLAIMER.md).

Dashboard card for the [Wallbox WEB integration](https://github.com/Filpin011/ha-wallbox-web), in the Wallbox WEB
app's dark Liquid Glass look: status band, power gauge with glow, energy / duration tiles, glass Start / Pause /
Resume / Stop buttons, live power curve, last charge cost and saving. Install with HACS (custom repository, category
*Dashboard*) or copy `wallbox-web-card.js` to `/config/www/` and add it as a JavaScript module resource. Add it from
the card picker and choose the station device in the visual editor. Options as in the table above.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md): `npm ci`, `npm run build`, `npm run demo` (mocked Home Assistant).

## License

[MIT](LICENSE)
