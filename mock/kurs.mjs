// Scripted answers for the video course recordings.
//
// The course videos type exactly these prompts. Each entry gives the answer,
// the chat title the title generator should return, and the streaming speed
// (ms per token), so the answer runs as long as the narration needs.
// Prompts are matched after trimming and collapsing whitespace.

const COURSE = [
  // 1.1 Willkommen: a short first impression
  {
    prompt: "Erkläre in zwei Sätzen, was ein Sprachmodell ist.",
    title: "Sprachmodell kurz erklärt",
    delay: 70,
    content:
      "Ein Sprachmodell ist ein KI-Programm, das aus sehr vielen Texten gelernt hat, wie Sprache aufgebaut ist. " +
      "Es sagt Wort für Wort vorher, was sinnvoll als Nächstes folgt, und kann so Fragen beantworten, Texte zusammenfassen oder Entwürfe schreiben.",
  },
  // 1.3 Ihre erste Frage
  {
    prompt: "Formuliere drei Ideen für einen Einführungsworkshop zu KI an unserer Hochschule.",
    title: "Ideen für KI-Workshop",
    delay: 130,
    content: `Gern, hier sind drei Ideen für einen Einführungsworkshop:

1. **KI zum Anfassen: Chat AI im Arbeitsalltag.** Die Teilnehmenden lösen kleine Aufgaben aus ihrem Alltag: eine E-Mail formulieren, einen Text zusammenfassen, Übungsfragen entwerfen. Danach vergleichen sie die Ergebnisse.

2. **Gute Fragen, gute Antworten: Prompting in 90 Minuten.** Ein kompakter Workshop zum Formulieren von Anfragen: Ziel, Zielgruppe und Form klar benennen, Antworten prüfen und gezielt nachhaken.

3. **Chancen und Grenzen: KI kritisch einordnen.** Eine Diskussionsrunde zu Halluzinationen, Datenschutz und guter wissenschaftlicher Praxis, mit Beispielen aus verschiedenen Fachbereichen.

Soll ich eine der Ideen weiter ausarbeiten?`,
  },
  {
    prompt: "Mach aus Idee 2 einen Ablaufplan für 90 Minuten.",
    title: "Ideen für KI-Workshop",
    delay: 38,
    content: `**Ablaufplan: Gute Fragen, gute Antworten (90 Minuten)**

| Zeit | Inhalt | Methode |
| --- | --- | --- |
| 0–10 min | Begrüßung, Erwartungen sammeln | Plenum |
| 10–25 min | Was ist ein Sprachmodell? Live-Demo in Chat AI | Input |
| 25–45 min | Ziel, Zielgruppe, Form: Fragen gezielt formulieren | Übung in Paaren |
| 45–60 min | Antworten prüfen und nachhaken | Gruppenarbeit |
| 60–80 min | Eigene Aufgaben aus dem Arbeitsalltag lösen | Einzelarbeit |
| 80–90 min | Ergebnisse teilen, offene Fragen klären | Plenum |

Tipp: Planen Sie etwas Puffer ein, Übungsphasen dauern erfahrungsgemäß länger als gedacht.`,
  },
  // 1.4 Antworten richtig einordnen
  {
    prompt: "Fasse die Vorteile von Open-Source-Sprachmodellen in drei Punkten zusammen.",
    title: "Vorteile von Open-Source-Modellen",
    delay: 30,
    content: `Die drei wichtigsten Vorteile:

1. **Kontrolle über die Daten:** Open-Source-Modelle lassen sich im eigenen Rechenzentrum betreiben. Eingaben müssen die Einrichtung nicht verlassen.
2. **Transparenz:** Gewichte und oft auch Trainingsdetails sind offen. Das erleichtert Forschung, Prüfung und Nachvollziehbarkeit.
3. **Anpassbarkeit:** Modelle können für eigene Fachgebiete feinjustiert oder mit eigenen Dokumenten kombiniert werden.`,
  },
  // 1.5 Neuer Chat und Chat-Verlauf
  {
    prompt: "Gib mir fünf Tipps für eine gelungene Präsentation.",
    title: "Tipps für Präsentationen",
    delay: 28,
    content: `1. **Kernbotschaft zuerst:** Überlegen Sie, was Ihr Publikum am Ende mitnehmen soll.
2. **Wenig Text auf den Folien:** Stichworte und Bilder statt ganzer Sätze.
3. **Klare Struktur:** Einstieg, drei Hauptpunkte, Fazit.
4. **Laut üben:** Einmal mit Uhr durchsprechen zeigt, wo es hakt.
5. **Raum für Fragen:** Planen Sie am Ende ein paar Minuten für Rückfragen ein.`,
  },
  // Seed chats so the chat list looks used (recorded before the videos start)
  {
    prompt: "Formuliere eine kurze Einladung zur Teamsitzung am Freitag.",
    title: "Einladung zur Teamsitzung",
    content: "Liebes Team,\n\nam Freitag um 10 Uhr treffen wir uns zur Teamsitzung im Raum 1.12. Themen sind die Semesterplanung und der KI-Workshop.\n\nViele Grüße",
  },
  {
    prompt: "Sortiere diese Literaturliste alphabetisch nach Nachnamen.",
    title: "Literaturliste sortieren",
    content: "Gern. Fügen Sie die Liste einfach ein, dann sortiere ich sie alphabetisch nach den Nachnamen der Autorinnen und Autoren.",
  },
  {
    prompt: "Wie schreibe ich eine gute Zusammenfassung?",
    title: "Gute Zusammenfassungen",
    content: "Lesen Sie den Text einmal ganz, markieren Sie die Kernaussagen und formulieren Sie diese in eigenen Worten, kurz und ohne Wertung.",
  },
];

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const byPrompt = new Map(COURSE.map((c) => [norm(c.prompt), c]));

// The scripted entry for the latest user message, or undefined.
export function courseReply(ctx) {
  return byPrompt.get(norm(ctx.text));
}

// A course title for a title request, keyed on the first user message of the chat.
export function courseTitle(firstUserText) {
  return byPrompt.get(norm(firstUserText))?.title;
}
