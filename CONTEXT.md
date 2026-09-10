# CONTEXT — Domain Model

Begriffe, die im Code eine feste Bedeutung haben. Neue Module werden nach
diesen Konzepten benannt; Änderungen an der Bedeutung werden hier gepflegt.

## Extension-Kern

**Enhancer** — die pro-`<video>`-Instanz (`VideoEnhancer`), die Enhancement
startet, stoppt, Einstellungen anwendet und zwischen Backends wechselt.
Genau ein Enhancer ist gleichzeitig aktiv (`activeEnhancer`-Arbitration).

**Enhancer-Lifecycle** — die geordnete Folge von Start, Stop, Backendwechsel,
Einstellungsänderung und Fullscreen-Reconcile eines Enhancers. Sie darf keine
veraltete Übergangsentscheidung nach einer neueren Änderung committen.

**Video-Population** — die verwaltete Menge aller Video-Instanzen einer Seite.
Sie umfasst Entdeckung, Zuordnung, Ersatz-Video-Reattach und Deinitialisierung;
die Population entscheidet nicht selbst, welches Video fullscreen gewinnt.

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

## RealESRGAN

**Pipeline** — die GPU-Pipeline-Klasse (`createRealEsrganPipelineClass` in
`src/core/realesrgan-pipeline.ts`), die pro Frame Readback, Pfadauswahl,
Inferenz-Dispatch und Composition über Staging-Slots serialisiert.

**Runner** — ein Inferenz-Backend hinter `RealEsrganInferenceRunner`
(Worker mit ORT-Session oder nativer Vulkan-Host über
`runFrame`/`runFrameRgba`). Runner werden über den **Runner-Broker**
(`src/core/realesrgan-runner-broker.ts`) gewählt: native-first mit
Retry-Cooldown, Worker-Fallback, E2E-Override. Das Interface trägt seine
Capabilities (Target-Downscale, `maxInFlight`, RGBA-Schnellpfad) als
deklarierte optionale Member — kein Duck-Typing. Langlebigkeit: Runner
sind prozess-langlebige Singletons des Brokers; ein Runner-Guard-Todesurteil
eskaliert über `markRunnerDead` an den Broker (Health-Owner), der den
Cache verwirft und beim nächsten Resolve neu wählt. Policy- und
Statistik-Vokabular sagt **Runner**, nicht „Worker“ (der ORT-Worker ist
ein Adapter unter mehreren); nur Adapter-eigene Namen (Worker-Client,
Worker-Protokoll) bleiben beim Worker.

**Runner-Guard** — die Failover-Policy (`src/core/realesrgan-runner-guard.ts`):
transiente Timeouts bekommen ein Budget, permanente Fehler und
Budgetverbrauch deaktivieren den Runner und wärmen die
Main-Thread-Fallback-Session. Klassifiziert über Fehler-Codes auf
Rejections, nie über Nachrichtentext. Transient ist, was in
`REALESRGAN_TRANSIENT_ERROR_CODES` steht (`worker-timeout`,
`native-frame-failed`, `native-frame-timeout`).

**Modell-Auswahl** — das Asset-Modul (`src/core/realesrgan-model-assets.ts`),
das „welche Modelldatei dient diesem Frame“ besitzt: URL-Resolution pro
Klasse (inkl. E2E-File-Override), einmalige HEAD-Verifikation der
Static-Shape-Varianten und den Per-Frame-Pick (`urlForShape`). Die
Session-Kaskade (`realesrgan-session.ts`) behält ihr eigenes
int8/fp16-Probing für den Main-Thread-Fallback; die Static-Shape-Regel
teilen beide über die Tabelle in `realesrgan-models.ts`. Eine
**Runner-Binding** koppelt Runner + Modell-Auswahl — das Runner-Interface
selbst bleibt modellagnostisch (der Worker bekommt die URL pro Frame, der
Native-Host hat sein Modell eingebrannt).

**Frame-Entscheidung** — der pure Per-Frame-Entscheidungskern
(`src/shared/realesrgan-frame-decision.ts`): Letterbox-Folge (verify →
reset → poll → observe → snap — die Reihenfolge trägt die Korrektheit),
Ziel-Geometrie (`planCropGeometry`) und Stillframe-Hold-Gate. Die Tracker
bleiben beim Pipeline-Besitzer; der Drain konsumiert Entscheidungen und
macht nur noch GPU-Arbeit.

**Pfadauswahl (Inference Path)** — die pure Entscheidung
(`src/shared/realesrgan-inference-path.ts`), in welcher Form ein Frame in
die Inferenz geht (`tight-rgba | planar`) und welcher Runner ihn bedient
(`runner-rgba | runner-planar | session`). Die Drain konsumiert den Tag
und bekommt verengte Buffer zurück.

**Session-Fallback** — die Main-Thread-ONNX-Session
(`src/core/realesrgan-session.ts`), shape-gepinnt und pro Klasse gecacht.
Sie dient Frames, wenn kein Runner lebt oder der Runner stirbt. Die
**Session-Factory** (`RealEsrganSessionFactory`) wird von
`setupRealEsrganBrowserRuntime()` gebaut und an den Loader gereicht:
Konfiguration, Cache und Kaskaden-Fortschritt sind Instanzzustand — „erst
konfigurieren, dann Session“ ist strukturell (keine Factory, keine
Session), nicht mehr nur Await-Disziplin.

**Frame-Job** — die Job-Orchestrierung (`src/core/realesrgan-frame-job.ts`)
über dem Pacing-Scheduler. Sie besitzt zwei verschiedene „newest“-Fragen:
den Publish-Gate (nur das neueste **eingereichte** Work published — für
Buchhaltung) und `claimPresentation`, das monotone Wasserzeichen über das
tatsächlich **Präsentierte** (für out-of-band Präsentation im Drain: ein
älteres Später-Landean kosmetisch nie über ein neueres Ergebnis malen, ein
älteres aber neuestes vollendetes wird trotzdem gezeigt). Slot-Bücher und
Adapter-Backpressure bleiben bei ihren Besitzern (Pipeline-Staging, Client).

**Tiling** — die Kachelplanung (`src/shared/realesrgan-tile-geometry.js`
als kanonisches Werk mit generierter Worker-Kopie): statische Modelle bei
exakter Shape-Übereinstimmung, dynamische sonst. Das Geometrie-Werk besitzt
auch die Main-Thread-Planungs-API (`adaptiveRealEsrganTiling`,
`planRealEsrganTiles`) und das Feather-Fenster — eine Formel für alle
Compose-Engines.

**Auto-Cap** — die Lastregelung (`src/shared/realesrgan-auto-cap.ts`):
anhaltende Überlast schaltet die Live-Inferenzhöhe die Leiter runter
(und bei Headroom wieder hoch), ohne gespeicherte Einstellungen zu
ändern.

**Letterbox** — die Inhaltserkennung (`src/shared/realesrgan-letterbox.ts`):
hysteretisch adoptiertes Content-Rechteck, pro Frame gegen die Balken
verifiziert; nur der Inhalt geht in die Inferenz.

**Stillframe** — das Halten (`src/shared/realesrgan-stillframe.ts`):
wiederholt sich der exakte Runner-Input, wird Inferenz und Compose
übersprungen und das präsentierte Ergebnis gehalten.

**Fehler-Codes** — die Taxonomie (`src/shared/realesrgan-error-codes.ts`):
`[RealESRGAN:{code}]` vor Klartext in Logs, Codes auf Rejections für
Policy-Entscheidungen. Fatal (kein Recovery: Gate fällt) gegen transient
(Retry deckt es: Gate zählt); `auto-cap-step` ist informativ (gehört in
keine der beiden Mengen). Produzenten taggen, der Guard entscheidet —
Produzentenseitige Klassifikation per Code, nie per Prosa (Worker-Replies
tragen `code`, der Native-Client taggt selbst).

**Fp32-Governor** — der Lastregler des Linux-ncnn-Hosts im fp32-Speichermodus
(`--no-fp16`/`ANIWEBSCALE_NO_FP16=1`, elemsize 4 über die ganze Kette). Echtes
fp32 ist ~2,5x langsamer als fp16; der Governor senkt daher pro Frame die
Inferenz-Skalierung (fraktionaler CPU-Box-Downsample des Inputs) auf ein
Netz-Zeitbudget und lässt das fp32-Postproc per Bilinear auf das
Presentation-Target hochskalieren. Default an (44ms Budget), abschaltbar per
`ANIWEBSCALE_FP32_BUDGET_MS=0`; fp16-Speicher und der tiled-Pfad bleiben
unangetastet. Qualitätsbeleg: `bench/native-fp32-governor-evidence.py`.

## Renderer

**Renderer** — der WebGPU-Teil (Device, Pipelines, Presentation). Besitzt
sein GPU-Device hinter einem injizierbaren Provider (Test-Seam). Der
Pipeline-Vertrag ist zweiphasig: `pass(encoder)` encodiert,
`afterSubmit()` wird nach dem `queue.submit()` gerufen — Pipelines mit
Nach-Submit-Arbeit (RealESRGAN-Readback) registrieren ihre
Completion-Tracking erst dort; die Ordnung ist Interface-Vertrag, kein
Timing-Unfall.

**Frame-Generation** — Interpolations-Subsystem des Renderers hinter dem
`FrameGenerationHost`-Seam; besitzt die Zwei-Textur-Historie.

**Native-Session** — die Windows-seitige Renderer-Sitzung, verwaltet vom
Background (`NativeSession`-Maschine) über den Native-Messaging-Host.
