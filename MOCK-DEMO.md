# ChatAI-Demo mit simulierten Modellen

Dieses Repository enthält die Weboberfläche von **Chat AI** der GWDG (Academic Cloud) aus
[gwdg/chat-ai](https://github.com/gwdg/chat-ai) (Version 1.0.2, inklusive Git-Historie) und dazu
einen **Mock-Server**, der eine OpenAI-kompatible API bereitstellt. Er simuliert **alle Modelle der
Academic Cloud unter ihren echten Namen und IDs** – 45 Chat-Modelle plus 3 Embedding-Modelle –
und dazu 4 Demo-Modelle für Sonderfälle. So lässt sich ChatAI komplett lokal vorführen: ohne
API-Key, ohne GPU und ohne dass Daten den Rechner verlassen.

> Die Mock-Modelle sind kleine Regelwerke, keine echten KI-Modelle. Sie tragen Namen, IDs und
> Fähigkeiten der echten Modelle und zeigen, **was ChatAI an ein Modell schickt und wie es Antworten
> darstellt**.

## Starten

**Variante A – Node.js** (Version 22 oder ≥ 20.19):

```bash
./mock/start-demo.sh
```

Beim ersten Start werden die Abhängigkeiten von `back/` und `front/` installiert. Danach
<http://localhost:8080> öffnen. Beenden mit `Strg+C`.

**Variante B – Docker:**

```bash
docker compose -f docker-compose.mock.yml up --build
```

Auch hier: <http://localhost:8080>. Die Compose-Datei entspricht der Original-`docker-compose.yml`,
nur mit zusätzlichem `mock`-Dienst und der Konfiguration aus `mock/config/`.

**Variante C – Vercel:** Das Repo enthält eine fertige `vercel.json`. Ein Vercel-Projekt, das mit
diesem Repo verbunden ist, baut das Frontend statisch und startet in einer einzigen Serverless-Funktion
(`api/index.mjs`) den unveränderten Backend-Proxy und den Mock-Server. Die Funktion leitet
`/backend/*` an den Proxy und `/v1/*` an die Mock-API weiter. Die Konfiguration dafür liegt in
`vercel/` (relative Pfade statt `localhost`, eigener Hinweisbanner).

## So hängt alles zusammen

```text
Browser ──> front :8080 ──> back :8081 ──> Mock-API :8090/v1              (diese Demo)
            React-App       Express-Proxy  └─> chat-ai.academiccloud.de/v1 (Produktion)
```

| Teil | Ordner | Aufgabe |
|---|---|---|
| Frontend | `front/` | React-App, läuft komplett im Browser. Chats liegen nur lokal (IndexedDB). |
| Backend | `back/` | Kleiner Proxy: hält den API-Key serverseitig und leitet Anfragen weiter. |
| Mock-API | `mock/` | Ersetzt die GWDG-API: `/v1/models`, `/v1/chat/completions` (Streaming), `/v1/embeddings`, `/v1/audio/speech`, `/v1/documents/convert/file`. Keine Abhängigkeiten, nur Node. |

Der einzige Unterschied zum Produktivbetrieb ist der `apiEndpoint` in `mock/config/back.json`.
Das Frontend ist unverändert und weiß nichts vom Mock.

## Die simulierten Modelle

Namen und IDs stammen aus der GWDG-Dokumentation ([Available Models](https://docs.hpc.gwdg.de/services/ai-services/chat-ai/models/),
[SAIA-API-Modellnamen](https://docs.hpc.gwdg.de/services/ai-services/saia/), Stand 31.10.2026), aus den
Modell-Konfigurationen in `front/src/config/models/` und für ältere OpenAI-Modelle aus
[gwdg/saia-hub](https://github.com/gwdg/saia-hub). Release, Kontext und Parameter sind aus der
GWDG-Doku übernommen, wo sie dort stehen; sonst bleiben die Felder leer.

So verhalten sich die Modelle:

- **Bilder / Audio / Video:** Nur Modelle mit dem passenden Eingabetyp erlauben Uploads. Der Mock
  nennt Format, Größe und Auflösung.
- **Thinking:** Open-Weight- und Claude-Modelle streamen einen sichtbaren Denkprozess
  („Reasoning Process“). Die Denk-Stufen kommen aus `front/src/config/models/<id>.json`, also
  genau wie beim echten Modell.
- **Reasoning (intern):** OpenAI-Modelle denken intern; ChatAI zeigt den Denkprozess nicht an.
  Der Mock nennt nur die gewählte Stufe.
- **Extern:** Modelle mit „(External)“ im Namen lösen den Datenschutz-Hinweis aus, Tools sind
  gesperrt.
- **Qwen 3 Coder Next** antwortet mit einem Code-Gerüst.

**Open-Weight, bei der GWDG gehostet** (10)

| Name | ID | Fähigkeiten |
|---|---|---|
| DeepSeek V4 Flash 0731 | `deepseek-v4-flash-0731` | Thinking |
| Gemma 4 31B Instruct | `gemma-4-31b-it` | Bilder, Thinking |
| GLM 5.3 Flash | `glm-5.3-flash` | Bilder, Thinking |
| Meta Llama 3.1 8B Instruct | `meta-llama-3.1-8b-instruct` | – |
| Qwen 3 30B A3B Instruct 2507 | `qwen3-30b-a3b-instruct-2507` | – |
| Qwen 3 Coder Next | `qwen3-coder-next` | – |
| Qwen 3 Omni 30B A3B Instruct | `qwen3-omni-30b-a3b-instruct` | Bilder, Audio, Video |
| Qwen 3.5 397B A17B | `qwen3.5-397b-a17b` | Bilder, Thinking |
| Qwen 3.6 35B A3B | `qwen3.6-35b-a3b` | Bilder, Thinking |
| Qwen 3.8 27B | `qwen3.8-27b` | Bilder, Video, Thinking |

**Extern (OpenAI, Anthropic)** (20)

| Name | ID | Fähigkeiten |
|---|---|---|
| Claude Sonnet 5 (External) | `claude-sonnet-5` | Bilder, Thinking |
| Claude Sonnet 4.6 (External) | `claude-sonnet-4-6` | Bilder, Thinking |
| GPT-5.6 Sol (External) | `openai-gpt5.6-sol` | Bilder, Reasoning (intern) |
| GPT-5.6 Terra (External) | `openai-gpt5.6-terra` | Bilder, Reasoning (intern) |
| GPT-5.6 Luna (External) | `openai-gpt5.6-luna` | Bilder, Reasoning (intern) |
| GPT-5.5 (External) | `openai-gpt5.5` | Bilder, Reasoning (intern) |
| GPT-5.4 (External) | `openai-gpt5.4` | Bilder, Reasoning (intern) |
| GPT-5.4 Mini (External) | `openai-gpt5.4-mini` | Bilder, Reasoning (intern) |
| GPT-5.4 Nano (External) | `openai-gpt5.4-nano` | Bilder, Reasoning (intern) |
| GPT-5.2 (External) | `openai-gpt5.2` | Bilder, Reasoning (intern) |
| GPT-5.1 (External) | `openai-gpt5.1` | Bilder, Reasoning (intern) |
| GPT-5 (External) | `openai-gpt5` | Bilder, Reasoning (intern) |
| GPT-5 Mini (External) | `openai-gpt5-mini` | Bilder, Reasoning (intern) |
| GPT-5 Nano (External) | `openai-gpt5-nano` | Bilder, Reasoning (intern) |
| o3 (External) | `openai-o3` | Bilder, Reasoning (intern) |
| o3-mini (External) | `openai-o3-mini` | Reasoning (intern) |
| GPT-4.1 (External) | `openai-gpt41` | Bilder |
| GPT-4.1 Mini (External) | `openai-gpt41-mini` | Bilder |
| o1 (External) | `openai-o1` | Bilder, Reasoning (intern) |
| o1 Mini (External) | `openai-o1-mini` | Reasoning (intern) |

**Kommerzielles Angebot (nur mit Freischaltung)** (10)

| Name | ID | Fähigkeiten |
|---|---|---|
| GPT-6 Sol (External) | `openai-gpt6-sol` | Bilder, Reasoning (intern) |
| GPT-6 Astra (External) | `openai-gpt6-astra` | Bilder, Reasoning (intern) |
| GPT-6 Luna (External) | `openai-gpt6-luna` | Bilder, Reasoning (intern) |
| Claude Opus 5.5 (External) | `claude-opus-5-5` | Bilder, Thinking |
| Claude Opus 5 (External) | `claude-opus-5` | Bilder, Thinking |
| Claude Opus 4.8 (External) | `claude-opus-4-8` | Bilder, Thinking |
| Claude Opus 4.7 (External) | `claude-opus-4-7` | Bilder, Thinking |
| Claude Opus 4.6 (External) | `claude-opus-4-6` | Bilder, Thinking |
| Claude Fable 5.1 (External) | `claude-fable-5-1` | Bilder, Thinking |
| Claude Fable 5 (External) | `claude-fable-5` | Bilder, Thinking |

**Im Chat-AI-Code konfiguriert, aktuell nicht in der GWDG-Liste** (5)

| Name | ID | Fähigkeiten |
|---|---|---|
| o4-mini (External) | `openai-o4-mini` | Bilder, Reasoning (intern) |
| GPT OSS 120B | `openai-gpt-oss-120b` | Thinking |
| Mistral Medium 3.5 128B | `mistral-medium-3.5-128b` | Thinking |
| GLM 4.7 | `glm-4.7` | Thinking |
| Qwen 3.5 122B A10B | `qwen3.5-122b-a10b` | Bilder, Thinking |

**Demo-Modelle für Sonderfälle** (4)

| Name | ID | Fähigkeiten |
|---|---|---|
| Demo: Echo | `mock-echo` | – |
| Demo: Markdown-Showcase | `mock-showcase` | – |
| Demo: Langsam (hohe Last) | `mock-slow` | – |
| Demo: Offline | `mock-offline` | – |

**Embeddings (nur API)** (3)

| Name | ID | Dimensionen |
|---|---|---:|
| E5 Mistral 7B Instruct | `e5-mistral-7b-instruct` | 4096 |
| Multilingual E5 Large Instruct | `multilingual-e5-large-instruct` | 1024 |
| Qwen 3 Embedding 4B | `qwen3-embedding-4b` | 2560 |

Die Embedding-Modelle sind wie bei der GWDG nur über die API erreichbar: `GET /v1/models` liefert
sie an API-Clients aus, an die ChatAI-Oberfläche aber nicht (der Proxy meldet sich mit dem Header
`inference-portal`). Separate GWDG-Dienste wie Image AI (FLUX.1-schnell, Qwen-Image-Edit) und
Voice AI (Whisper) gehören nicht zur Chat-AI-Modellliste und sind nicht enthalten.

Auch die Hintergrundaufgaben von ChatAI werden bedient: **Chat-Titel** und **Gedächtnis**
(Memory) laufen wie in der Original-Beispielkonfiguration über `qwen3-30b-a3b-instruct-2507`.

`node mock/check-catalog.mjs` prüft, ob jedes im Frontend konfigurierte Modell einen Mock hat –
hilfreich nach einem Update aus dem Original-Repo.

## Vorführung in zehn Schritten

1. **„Hallo“** schreiben – das Standardmodell *Qwen 3 30B A3B Instruct 2507* stellt sich mit seinen
   Eckdaten vor. Der Chat bekommt automatisch einen Titel.
2. **„Wie funktioniert ChatAI?“** – Architektur und Datenfluss. **„Modelle“** zeigt alle simulierten
   Modelle nach Kategorie.
3. Unten im Modellmenü suchen und **Qwen 3.8 27B** wählen, eine Frage stellen und den Block
   „Reasoning Process“ aufklappen. Über das Regler-Symbol die Denk-Stufe ändern.
4. Bei **Qwen 3.8 27B** oder **Gemma 4 31B Instruct** über die Büroklammer ein Bild anhängen.
5. **Claude Sonnet 5 (External)** oder **GPT-5.5 (External)** wählen: Datenschutz-Hinweis, gesperrte
   Tools, sichtbares bzw. internes Reasoning.
6. Ein **PDF** anhängen, auf **Process** tippen und z. B. „Fasse das zusammen“ schreiben.
   Der Mock-Server spielt dabei Docling und liest den Text einfacher PDFs aus.
7. Mit einem GWDG-Modell über das **Schraubenschlüssel-Symbol** die Tools einschalten und
   **Web Search** aktivieren. Dann eine Frage stellen – oder „Erstelle ein Bild von einem Leuchtturm“
   (Bildgenerierung ist standardmäßig aktiv). Die Tool-Schritte erscheinen im aufklappbaren Block.
8. **Gedächtnis:** unten links auf *Sample User* → *Memories* → *Learn*. Dann „Ich heiße …“
   schreiben, einen neuen Chat öffnen und „Hallo“ sagen.
9. Unter einer Antwort auf das **Lautsprecher-Symbol** tippen: Der Mock „liest vor“ (ein Ton pro Wort).
10. **Demo: Langsam** wählen und während der Antwort auf **Stopp** tippen; **Demo: Offline** zeigt
    Hinweisfenster und Fehlermeldung.

Im Terminal protokolliert der Mock-Server jede Anfrage, z. B.:

```text
16:29:23 [mock] chat model=openai-gpt5.6-sol stream=true messages=2 temp=0.5 top_p=0.5 auth=yes
16:29:25 [mock] chat model=qwen3-30b-a3b-instruct-2507 stream=false messages=4 task=title auth=yes
```

## Die Mock-API direkt nutzen

```bash
curl http://localhost:8090/v1/models
curl http://localhost:8090/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model": "meta-llama-3.1-8b-instruct", "messages": [{"role": "user", "content": "Hilfe"}]}'
curl http://localhost:8090/v1/embeddings -H "Content-Type: application/json" \
  -d '{"model": "e5-mistral-7b-instruct", "input": "Hallo Welt"}'
```

Oder mit dem offiziellen OpenAI-SDK, genau wie bei der Academic-Cloud-API:

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8090/v1", api_key="mock")
print(client.chat.completions.create(
    model="qwen3-30b-a3b-instruct-2507",
    messages=[{"role": "user", "content": "Hilfe"}],
).choices[0].message.content)
```

## Funktionsinventar

Alle 106 Funktionen der Oberfläche mit Beschreibung, Fundort und Screenshot stehen in
[docs/funktionsinventar](docs/funktionsinventar/README.md).

## Auf echte Modelle umstellen

Wer einen API-Key für Chat AI hat, nutzt die Original-Konfiguration aus dem Upstream-Projekt:

```bash
cp secrets/front.json.sample secrets/front.json
cp secrets/back.json.sample  secrets/back.json   # apiKey eintragen
docker compose up            # oder: back/ und front/ einzeln starten, siehe README.md
```

Dann zeigt `back.json` auf `https://chat-ai.academiccloud.de/v1`, und im Modellmenü erscheinen die
echten Modelle – mit denselben IDs wie im Mock. Externe Modelle sind laut GWDG nicht generell per
API freigeschaltet. `secrets/*.json` ist per `.gitignore` vom Commit ausgeschlossen.

## Modelle ergänzen oder aktualisieren

1. In `mock/catalog.mjs` einen Eintrag mit `model(id, name, anbieter, familie, { … })` anlegen.
   Felder wie bei der GWDG-API: Eingabetypen, Thinking (`"visible"` oder `"hidden"`), extern,
   Release, Kontext, Parameter, Beschreibung.
2. Optional: `front/src/config/models/<modell-id>.json` für Reasoning-Stufen anlegen.
3. `node mock/check-catalog.mjs` ausführen und den Mock-Server neu starten.

Die Antworten stehen in `mock/models.mjs` und richten sich automatisch nach den Fähigkeiten im
Katalog.

## Änderungen gegenüber gwdg/chat-ai

- Neu: `mock/` (Mock-Server mit Modellkatalog, Demo-Konfiguration, Startskript, Dockerfile),
  `docker-compose.mock.yml` und diese Datei.
- Fehlerbehebung `back/service.mjs`: Der PDF-Upload schlug fehl, weil das Frontend die Datei im
  Feld `files` schickt, der Proxy aber nur `document` akzeptierte und dann das falsche Objekt
  weiterreichte.
- Fehlerbehebung `front/src/apis/generateAudio.jsx`: Vorlesen brach bei Audiodateien ab ca. 100 KB
  mit „Maximum call stack size exceeded“ ab. Die Base64-Umwandlung läuft jetzt in Blöcken.
- Deutsch als Standardsprache: neuer, optionaler Schlüssel `defaultLanguage` in `front.json`
  (in beiden Demo-Konfigurationen auf `de`). Hart codierte englische Texte der Oberfläche
  (Modellauswahl, Nachrichten-Buttons, Regler, Dialoge, Meldungen, Werkzeug-Fortschritt) laufen
  jetzt über die Übersetzungsdateien.
- Fehlerbehebung `MermaidDiagram.jsx`: Diagramme zeigten leere Kästen, weil die SVG-Bereinigung
  die HTML-Beschriftungen entfernte. Mermaid erzeugt jetzt reine SVG-Texte.

Updates aus dem Original-Repo holen:

```bash
git remote add upstream https://github.com/gwdg/chat-ai.git   # einmalig
git pull upstream main
```

## Grenzen

- Die Mock-Modelle verstehen keine Inhalte; sie folgen festen Regeln.
- `mock/config/front.json` verweist auf `http://localhost:8081`. Für den Zugriff von einem anderen
  Gerät (z. B. Handy im WLAN) müssen `backendPath`, `modelsPath` und `userDataPath` auf die
  Adresse des Rechners zeigen.
- Videogenerierung, Arcana und MCP werden nur angedeutet.
- Die Modellliste ist eine Momentaufnahme vom 31.10.2026. Neue GWDG-Modelle müssen im Katalog
  nachgetragen werden.

Lizenz: GPL-3.0, wie das Original (siehe `LICENSE`).
