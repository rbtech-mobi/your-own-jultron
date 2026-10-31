"use strict";

const STATUS = {
  validated: "Validated",
  implemented: "Implemented",
  investigating: "Investigating",
  designed: "Designed",
};

const LEGENDA = [
  ["validated", "Exercised on target hardware"],
  ["implemented", "Code and unit tests only"],
  ["investigating", "Open technical question"],
  ["designed", "Specified, not deployed"],
];

const SISTEMA = [
  ["Voice interpretation", "validated"],
  ["Device transport", "validated"],
  ["Boot services", "validated"],
  ["Session lifecycle", "implemented"],
  ["Approval gate", "implemented"],
  ["Speech output", "investigating"],
  ["Remote agent", "designed"],
  ["Android client", "designed"],
];

const TRACES = {
  "Approved search": [
    ["00.000", "session.opened", "supervisor", "listening"],
    ["01.214", "vad.speech_started", "capture", "listening"],
    ["05.630", "vad.segment_closed", "capture", "listening"],
    ["05.642", "model.interpret.request", "inference", "thinking"],
    ["07.018", "model.interpret.response", "inference", "listening"],
    ["07.021", "gate.proposal_created", "supervisor", "awaiting_approval"],
    ["07.094", "mqtt.published", "transport", "awaiting_approval"],
    ["11.402", "gate.approved", "device", "thinking"],
    ["11.410", "model.search.request", "inference", "thinking"],
    ["14.602", "model.search.response", "inference", "listening"],
    ["14.671", "mqtt.published", "transport", "listening"],
    ["59.671", "session.closed", "supervisor", "idle"],
  ],
  "Quota exhausted": [
    ["00.000", "session.opened", "supervisor", "listening"],
    ["02.380", "vad.segment_closed", "capture", "listening"],
    ["02.391", "model.interpret.request", "inference", "thinking"],
    ["03.012", "model.interpret.rejected", "inference", "listening"],
    ["03.013", "backoff.started", "supervisor", "listening"],
    ["03.014", "ui.notice", "panel", "listening"],
    ["09.760", "vad.segment_dropped", "supervisor", "listening"],
  ],
  "Operator stop": [
    ["00.000", "session.opened", "supervisor", "listening"],
    ["03.106", "model.interpret.request", "inference", "thinking"],
    ["03.840", "operator.stop", "panel", "idle"],
    ["03.841", "queue.flushed", "supervisor", "idle"],
    ["04.522", "model.interpret.discarded", "supervisor", "idle"],
  ],
};

const MAQUINA = `            start | device YES
   ┌─────┐ ──────────────────→ ┌───────────┐
   │ idle│                     │ listening │ ←──────┐
   └─────┘ ←────────────────── └─────┬─────┘        │
      ↑     stop | 45 s silence      │ speech       │ response
      │     | 300 s session          ↓              │
      │                        ┌───────────┐        │
      └─────────────────────── │ thinking  │ ───────┘
                 stop          └─────┬─────┘
                                     │ search intent
                                     ↓
                               ┌───────────────────┐
                               │ awaiting_approval │  expires after 60 s
                               └───────────────────┘`;

const SEQUENCIA = `Mic      Supervisor        Model API        Broker        Device
 │ audio     │                  │               │             │
 │─────────→ │ interpret(wav)   │               │             │
 │           │ ───────────────→ │               │             │
 │           │ {search: true}   │               │             │
 │           │ ←─────────────── │               │             │
 │           │ publish proposal │               │             │
 │           │ ─────────────────────────────→   │ ──────────→ │
 │           │                  │               │    YES      │
 │           │ ←───────────────────────────── ─ │ ←────────── │
 │           │ search(query)    │               │             │
 │           │ ───────────────→ │               │             │
 │           │ result           │               │             │
 │           │ ←─────────────── │               │             │
 │           │ publish result   │               │             │
 │           │ ─────────────────────────────→   │ ──────────→ │`;

const COMPONENTES = {
  capture: { nome: "Audio capture", x: 30, y: 30, ativo: true, funcao: "Reads PCM frames and segments speech with WebRTC VAD.", tecnologia: "PipeWire, arecord, Python", decisao: "Audio stays in memory. Frames are dropped while idle." },
  sensor: { nome: "Sensor node", x: 30, y: 170, ativo: false, funcao: "Emits presence events.", tecnologia: "Arduino, serial", decisao: "Code exists. Hardware integration pending." },
  supervisor: { nome: "Supervisor", x: 280, y: 100, ativo: true, funcao: "Owns session state, approvals, backoff and routing.", tecnologia: "Python, systemd user services", decisao: "Single process with worker threads. No broker between local modules." },
  panel: { nome: "Control panel", x: 280, y: 250, ativo: true, funcao: "Renders state, conversation, audio levels and settings.", tecnologia: "WebGL, WebSocket, Firefox kiosk", decisao: "Fails independently from voice over local UDP events." },
  inference: { nome: "Inference APIs", x: 540, y: 30, ativo: true, funcao: "Native audio understanding and grounded search.", tecnologia: "Gemini, OpenRouter", decisao: "Conversation and search models are selected separately." },
  broker: { nome: "MQTT broker", x: 540, y: 170, ativo: true, funcao: "Connects nodes across isolated networks.", tecnologia: "HiveMQ Cloud, MQTT over TLS", decisao: "Managed broker chosen over a local one because of double NAT." },
  device: { nome: "Display device", x: 540, y: 310, ativo: true, funcao: "Displays output and emits four discrete actions.", tecnologia: "ESP32, C++", decisao: "Firmware contract preserved. The supervisor adapts to it." },
  android: { nome: "Android client", x: 30, y: 310, ativo: false, funcao: "Remote interface and voice endpoint.", tecnologia: "Kotlin, WebView, WebRTC", decisao: "Thin client. Credentials stay server side." },
  agent: { nome: "Remote agent", x: 280, y: 380, ativo: false, funcao: "Executes tools and automations.", tecnologia: "n8n, PostgreSQL, Supabase gateway", decisao: "Realtime audio bypasses the agent, which only handles tool calls." },
};

const CONEXOES = [
  { de: "capture", para: "supervisor", nome: "Speech segments", protocolo: "In-process queue", dados: "PCM 16 kHz, 30 ms frames", falha: "Bounded queue. Overflow drops the segment." },
  { de: "supervisor", para: "inference", nome: "Interpretation", protocolo: "HTTPS", dados: "WAV, structured JSON response", falha: "HTTP 429 triggers a 10 minute backoff." },
  { de: "supervisor", para: "broker", nome: "Output", protocolo: "MQTT, QoS 1, TLS", dados: "JSON, 460 bytes max", falha: "Automatic reconnect. Client-side rate limit." },
  { de: "device", para: "broker", nome: "Actions", protocolo: "MQTT, QoS 1, TLS", dados: "Allowlisted action enum", falha: "Invalid payloads are discarded." },
  { de: "supervisor", para: "panel", nome: "Telemetry", protocolo: "UDP to WebSocket", dados: "State, level, messages", falha: "Fire and forget. Panel loss does not affect voice." },
  { de: "sensor", para: "supervisor", nome: "Presence", protocolo: "Serial, 9600 baud", dados: "Line-delimited events", falha: "Debounced with a 300 s interval." },
  { de: "android", para: "agent", nome: "Client API", protocolo: "HTTPS through gateway", dados: "Action envelope", falha: "Per-user daily quota at the gateway." },
];

const CONTRATOS = [
  ["model.interpret.response", `{
  "chamado": true,
  "pesquisa": true,
  "entrada": "ESP32 price",
  "saida": "Search ESP32 price?"
}`],
  ["device.output", `{
  "source": "Jarvis",
  "message": "string, max 460 bytes"
}`],
  ["device.action", `{
  "action": "YES | NO | STOP | UNDO",
  "source": "esp32_touch",
  "device": "string",
  "ts_ms": 0
}`],
  ["gateway.request", `{
  "acao": "sessao | mensagem | ferramenta",
  "dados": {}
}`],
];

const FALHAS = [
  ["Model quota exhausted", "HTTP 429", "10 minute backoff. Notice stays on the panel, off the device channel.", "implemented"],
  ["Model unavailable", "HTTP 5xx, timeout", "One retry after 3 s, then a panel-only notice.", "implemented"],
  ["Broker disconnect", "paho callback", "Reconnect with backoff from 2 to 60 s.", "implemented"],
  ["Output burst", "Client-side window", "Maximum of 6 messages per minute.", "implemented"],
  ["Panel crash", "systemd", "Service restart. Voice remains active.", "implemented"],
  ["Supervisor crash", "systemd", "Restart after 5 s, returning to idle.", "implemented"],
  ["Stale approval", "60 s deadline", "Proposal expires and YES opens a session instead.", "implemented"],
];

const ADRS = [
  ["ADR-005", "Session-scoped listening", "Accepted", "Continuous capture produced uncontrolled API usage and sent unintended speech off-device.", "Always-on listening. Local wake word only.", "Requires a physical or UI start. Wake word remains an open investigation."],
  ["ADR-019", "Cloud audio inference", "Accepted", "Whisper tiny was inaccurate and base exceeded real time on the target CPU.", "whisper.cpp. Larger local models.", "Adds network dependency and provider quota. Local path retained as fallback."],
  ["ADR-029", "Managed MQTT broker", "Accepted", "Device and host sit on different networks behind double NAT.", "Local Mosquitto. Local HiveMQ. Secondary Wi-Fi interface.", "External dependency, but no inbound exposure on the lab host."],
  ["ADR-032", "Failure isolation from device channel", "Accepted", "A quota incident published repeated errors to the device.", "Server-side filtering only.", "Device receives results, never transport or model errors."],
  ["ADR-033", "Separate conversation and search models", "Accepted", "Audio understanding and grounded search have different quota and capability profiles.", "Single model for all tasks.", "Two routes to configure and observe."],
  ["ADR-038", "Direct realtime audio with tool calling", "Proposed", "Webhook orchestration cannot sustain low-latency bidirectional audio.", "Audio through n8n.", "Client must handle ephemeral sessions."],
];

const BENCHMARKS = [
  ["STT latency, local", "faster-whisper int8, 10 s ambient clip, n=1", "tiny 1.1 s, base 12.9 s", "Base exceeds real time on this CPU."],
  ["STT accuracy, local", "Scripted Portuguese phrases, informal review", "tiny failed, base usable, wake word missed", "Rejected as primary path."],
  ["VAD saturation", "WebRTC VAD at 4 capture gains", "99% to 0% speech frames from 100% to 20% gain", "Internal microphone rejected."],
  ["Capture signal", "RMS per second, USB microphone", "Speech 800 to 2700, silence 20 to 130", "Usable separation at full gain."],
  ["Render load", "Per-process CPU over 30 s, light mode", "Browser 97.5%, shell 25.6% of one core", "Rendering dominates, not the desktop."],
  ["Memory load", "PSS by process group", "Browser 528 MB, GNOME 590 MB, supervisor 50 MB", "Memory is not the constraint."],
  ["Supervisor overhead", "Cloud inference path, 30 s window", "1.6% of one core", "Local inference removal freed the host."],
  ["Grounded search", "Single API request", "3.2 s", "Viable for confirmed requests."],
  ["TTS generation", "Two models, 5 s phrase, n=1", "Flash-Lite 3.1 s, Flash 4.6 s", "Streaming required before integration."],
];

const CI = [
  ["compile", "Byte-compiles all Python sources", "validated"],
  ["unit", "38 tests: state machine, contracts, parsing, limits", "validated"],
  ["js-syntax", "node --check on panel and site", "validated"],
  ["shell-syntax", "bash -n on operational scripts", "validated"],
  ["secret-scan", "Tracked content and private file names", "validated"],
  ["hosted-ci", "Remote pipeline and integration tests", "designed"],
];

const REGISTRO = [
  ["v0.15", "Local quality gate and technical site", "Gate passes in about 1 s", "No hosted CI"],
  ["v0.11", "Session state machine", "38 unit tests, state transitions over WebSocket", "No end-to-end voice run yet"],
  ["v0.10", "Runtime settings and dual inference routes", "Settings exercised against the live panel", "OpenRouter search needs credits"],
  ["v0.9.1", "Failure isolation and rate limiting", "Regression tests after a quota incident", "Backoff is a fixed window"],
  ["v0.8", "Grounded search with approval gate", "Live API call in 3.2 s", "Full device flow not measured"],
  ["v0.7", "MQTT over TLS and device actions", "Action received from hardware", "Device output depends on firmware buffer"],
  ["v0.6", "Native audio inference", "Spoken request answered on the panel", "Free tier quota is low"],
  ["v0.5", "Boot services and kiosk display", "Recovered after host reboot", "Rendering cost on integrated graphics"],
  ["v0.3", "WebGL core and static deployment", "Security headers verified in production", "No frame time metric"],
];

const INVESTIGACOES = [
  ["Local wake word on target CPU", "Accuracy and false positive measurement"],
  ["End-to-end voice latency", "Runtime event instrumentation"],
  ["Rendering on integrated graphics", "Frame time capture in the kiosk"],
  ["Realtime client on Android", "Client implementation and session token flow"],
];
