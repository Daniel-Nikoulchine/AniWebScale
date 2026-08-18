# CONTEXT — Domain Model

Begriffe, die im Code eine feste Bedeutung haben. Neue Module werden nach
diesen Konzepten benannt; Änderungen an der Bedeutung werden hier gepflegt.

## Extension-Kern

**Enhancer** — die pro-`<video>`-Instanz (`VideoEnhancer`), die Enhancement
startet, stoppt, Einstellungen anwendet und zwischen Backends wechselt.
Genau ein Enhancer ist gleichzeitig aktiv (`activeEnhancer`-Arbitration).

**Site Access** — die Nutzerfreigabe, auf welchen Origins die Extension
überhaupt läuft (optional host permissions + dynamische Content-Script-
Registrierung). Das **Site-Access-Service**-Modul in `src/site-access.ts`
besitzt die Operationen `grant / revoke / describe / synchronize`; UI-Seiten
und Background-Listener sind nur Aufrufer.

**Fullscreen-Kontext** — die Frage „welches Video ist gerade fullscreen und
gewinnt die Enhancement-Auswahl". Besessen vom Fullscreen-Kontext-Modul
(`src/core/fullscreen-context.ts`): Subscription (inkl. `window.top`),
autoritatives Fullscreen-Element, **Bevorzugtes Video** (Wahl nach Fläche,
dann videoId), Change-Event. Overlay, Layout-Manager und Enhancer
konsumieren die Entscheidung, leiten sie nicht selbst aus dem DOM ab.

**Übergang (Transition)** — jede Zustandsänderung am Backend eines Enhancers
(starten, stoppen, Backend wechseln, Einstellungen anwenden, Fullscreen
reconcilen). Übergänge laufen über **eine** serialisierte Kette pro
Enhancer; Revisionsprüfungen sind interne Absicherung, kein Aufrufer-Vertrag.

**Native-Session-Client** — das Modul, das das Message-Protokoll zur
Background-Seite für native Sitzungen kapselt (claim, fallback request,
stop, update, playback state, release). Der Enhancer ruft nur diesen
Client; im Test ist ein Fake der zweite Adapter am Seam.

**Anwenden von Einstellungen (applySettings)** — speichern (render +
local Keys), background benachrichtigen, Ergebnis dreistufig melden:
`applied | saved-not-applied | failed`. Alle UI-Seiten benutzen dieselbe
Funktion; keine Seite komponiert mehr selbst.

## Protokoll

**Runtime-Request** — Nachricht von Content/UI an den Background
(`chrome.runtime.sendMessage`), streng geparst und über Konstruktoren
gebaut (`src/shared/runtime-messages.ts`).

**Frame-Message** — Nachricht vom Background an einen Content-Script-Frame
(`chrome.tabs.sendMessage`), dieselbe Disziplin in beide Richtungen.

## Renderer

**Renderer** — der WebGPU-Teil (Device, Pipelines, Presentation). Besitzt
sein GPU-Device hinter einem injizierbaren Provider (Test-Seam).

**Frame-Generation** — Interpolations-Subsystem des Renderers hinter dem
`FrameGenerationHost`-Seam; besitzt die Zwei-Textur-Historie.

**Native-Session** — die Windows-seitige Renderer-Sitzung, verwaltet vom
Background (`NativeSession`-Maschine) über den Native-Messaging-Host.
