# ChatAI-Demo mit simulierten Modellen

Dieses Repository enthält die Weboberfläche von **Chat AI** der GWDG (Academic Cloud) aus
[gwdg/chat-ai](https://github.com/gwdg/chat-ai) (Version 1.0.2, inklusive Git-Historie) und dazu
einen **Mock-Server**, der eine OpenAI-kompatible API mit acht simulierten Modellen bereitstellt.
So lässt sich ChatAI komplett lokal vorführen: ohne API-Key, ohne GPU und ohne dass Daten den
Rechner verlassen.

> Die Mock-Modelle sind kleine Regelwerke, keine echten KI-Modelle. Sie zeigen, **was ChatAI an ein
> Modell schickt und wie es Antworten darstellt**.

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

## So hängt alles zusammen

```text
Browser ──> front :8080 ──> back :8081 ──> Mock-API :8090/v1              (diese Demo)
            React-App       Express-Proxy  └─> chat-ai.academiccloud.de/v1 (Produktion)
```

| Teil | Ordner | Aufgabe |
|---|---|---|
| Frontend | `front/` | React-App, läuft komplett im Browser. Chats liegen nur lokal (IndexedDB). |
| Backend | `back/` | Kleiner Proxy: hält den API-Key serverseitig und leitet Anfragen weiter. |
| Mock-API | `mock/` | Ersetzt die GWDG-API: `/v1/models`, `/v1/chat/completions` (Streaming), `/v1/audio/speech`, `/v1/documents/convert/file`. Keine Abhängigkeiten, nur Node. |

Der einzige Unterschied zum Produktivbetrieb ist der `apiEndpoint` in `mock/config/back.json`.
Das Frontend ist unverändert und weiß nichts vom Mock.

## Die simulierten Modelle

| Modell | Zeigt |
|---|---|
| **Mock Assistent** (Standard) | Reagiert auf Stichworte („Hilfe“, „Wie funktioniert ChatAI?“, „Tabelle“, „Code“, „Formel“, „Ich heiße …“). Sonst zeigt er, welche Parameter ChatAI mitgeschickt hat (Temperatur, top_p, Systemprompt, Anhänge, Tools …). |
| **Mock Reasoning** | Streamt erst einen Denkprozess (aufklappbarer „Reasoning Process“-Block), dann die Antwort. Die Denk-Stufe (none/low/medium/high) kommt aus `front/src/config/models/mock-reasoning.json`. |
| **Mock Vision** | Nimmt Bilder an und nennt Format, Größe und Auflösung. Nur Modelle mit Eingabetyp `image` erlauben Bild-Uploads. |
| **Mock Markdown-Showcase** | Tabellen, Code mit Syntax-Highlighting, LaTeX-Formeln, Listen. |
| **Mock Echo** | Gibt die Nachricht unverändert zurück. |
| **Mock Langsam (hohe Last)** | Streamt Wort für Wort; die Auslastungsanzeige steht auf orange. Gut für den Stopp-Button. |
| **Mock Cloud (External)** | Gilt als externes Modell: ChatAI zeigt einen Datenschutz-Hinweis und sperrt die Tools. |
| **Mock Offline** | Status „offline“: Hinweisfenster beim Auswählen, Fehlermeldung beim Senden. |

Auch die Hintergrundaufgaben von ChatAI werden bedient: **Chat-Titel** und **Gedächtnis**
(Memory) laufen über `mock-assistant`.

## Vorführung in zehn Schritten

1. **„Hallo“** schreiben – Begrüßung und Übersicht. Der Chat bekommt automatisch einen Titel.
2. **„Wie funktioniert ChatAI?“** – Architektur und Datenfluss.
3. Unten im Modellmenü **Mock Reasoning** wählen und eine Frage stellen. Den Block „Reasoning
   Process“ aufklappen. Über das Regler-Symbol (Einstellungen) die Denk-Stufe ändern.
4. **Mock Vision** wählen, über die Büroklammer ein Bild anhängen und fragen.
5. Ein **PDF** anhängen, auf **Process** tippen und z. B. „Fasse das zusammen“ schreiben.
   Der Mock-Server spielt dabei Docling und liest den Text einfacher PDFs aus.
6. Über das **Schraubenschlüssel-Symbol** die Tools einschalten und **Web Search** aktivieren.
   Dann eine Frage stellen – oder „Erstelle ein Bild von einem Leuchtturm“ (Bildgenerierung ist
   standardmäßig aktiv). Die Tool-Schritte erscheinen im aufklappbaren Block.
7. **Gedächtnis:** unten links auf *Sample User* → *Memories* → *Learn*. Dann „Ich heiße …“
   schreiben, einen neuen Chat öffnen und „Hallo“ sagen.
8. Unter einer Antwort auf das **Lautsprecher-Symbol** tippen: Der Mock „liest vor“ (ein Ton pro Wort).
9. **Mock Langsam** wählen und während der Antwort auf **Stopp** tippen.
10. **Mock Offline** und **Mock Cloud (External)** wählen, um Fehlerfall und Datenschutz-Hinweis zu zeigen.

Im Terminal protokolliert der Mock-Server jede Anfrage, z. B.:

```text
16:04:52 [mock] chat model=mock-assistant stream=true messages=2 temp=0.5 top_p=0.5 auth=yes
16:04:54 [mock] chat model=mock-assistant stream=false messages=4 task=title auth=yes
```

## Die Mock-API direkt nutzen

```bash
curl http://localhost:8090/v1/models
curl http://localhost:8090/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model": "mock-echo", "messages": [{"role": "user", "content": "Test"}]}'
```

Oder mit dem offiziellen OpenAI-SDK, genau wie bei der Academic-Cloud-API:

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8090/v1", api_key="mock")
print(client.chat.completions.create(
    model="mock-assistant",
    messages=[{"role": "user", "content": "Hilfe"}],
).choices[0].message.content)
```

## Auf echte Modelle umstellen

Wer einen API-Key für Chat AI hat, nutzt die Original-Konfiguration aus dem Upstream-Projekt:

```bash
cp secrets/front.json.sample secrets/front.json
cp secrets/back.json.sample  secrets/back.json   # apiKey eintragen
docker compose up            # oder: back/ und front/ einzeln starten, siehe README.md
```

Dann zeigt `back.json` auf `https://chat-ai.academiccloud.de/v1`, und im Modellmenü erscheinen die
echten Modelle. `secrets/*.json` ist per `.gitignore` vom Commit ausgeschlossen.

## Eigene Mock-Modelle ergänzen

1. In `mock/models.mjs` einen Eintrag in `MODELS` anlegen (Felder wie bei der GWDG-API:
   `input`, `output`, `status`, `demand`, `description` …).
2. Unten in `RESPONDERS` eine Funktion hinterlegen, die `{ content, reasoning? }` zurückgibt.
3. Optional: `front/src/config/models/<modell-id>.json` für Reasoning-Stufen anlegen.
4. Mock-Server neu starten.

## Änderungen gegenüber gwdg/chat-ai

- Neu: `mock/` (Mock-Server, Demo-Konfiguration, Startskript, Dockerfile),
  `docker-compose.mock.yml`, diese Datei und `front/src/config/models/mock-reasoning.json`.
- Fehlerbehebung `back/service.mjs`: Der PDF-Upload schlug fehl, weil das Frontend die Datei im
  Feld `files` schickt, der Proxy aber nur `document` akzeptierte und dann das falsche Objekt
  weiterreichte.
- Fehlerbehebung `front/src/apis/generateAudio.jsx`: Vorlesen brach bei Audiodateien ab ca. 100 KB
  mit „Maximum call stack size exceeded“ ab. Die Base64-Umwandlung läuft jetzt in Blöcken.

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

Lizenz: GPL-3.0, wie das Original (siehe `LICENSE`).
