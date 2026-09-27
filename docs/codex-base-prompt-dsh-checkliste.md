# Codex-Basisprompts in DSH: Kompatibilitäts-Checkliste

**Ziel:** Die Konzepte aus den GPT-6-Prompts übernehmen, ohne einem DSH-Agenten falsche Codex-Tools oder Regeln zu geben. **Stand nach dem zweiten Pass:** Die drei DSH-Fassungen sind im Plugin-Quellcode umgesetzt. Die Tabellen unten dokumentieren die geprüften **Originaltexte** und ihre Übertragung; sie beschreiben nicht mehr den unveränderten aktuellen Plugin-Prompt.

**Untersuchter Stand:** Codex-Checkout `8e17909b27875b76b1e9a883a604ed24e969d609`, jeweils nur `model_messages.instructions_template`: [Astra](<C:/Users/pasca/Coding/codex/codex-rs/models-manager/models.json#L76>), [Sol](<C:/Users/pasca/Coding/codex/codex-rs/models-manager/models.json#L249>), [Luna](<C:/Users/pasca/Coding/codex/codex-rs/models-manager/models.json#L417>). Der [Plugin-Schalter](<dsh-codex-subscription/src/index.js#L144-L149>) ist weiterhin standardmäßig aus und heißt jetzt **DSH model guidance**. Er hängt ausschließlich die [lokalen DSH-Fassungen](<dsh-codex-subscription/src/codex-base-prompts.js>) an; der [Modellkatalog](<dsh-codex-subscription/src/model-catalog.js>) darf nur Fähigkeiten aktualisieren, keine Prompttexte. Die gespeicherte Einstellung `codexBasePrompt` bleibt kompatibel. Es gibt keinen ungeprüften Original-/Online-Prompt-Fallback. Native Codex-Subtasks sind nicht betroffen.

## Legende

- **✅ Passend:** Konzept und Anwendung sind ohne Codex-spezifische Voraussetzungen brauchbar.
- **🔁 Übertragen:** DSH bietet das Konzept, aber über andere Tools, Namen oder Regeln. Inhalt neu formulieren.
- **⛔ Nicht vorhanden:** Die konkret genannte Codex-Schnittstelle existiert hier nicht. Streichen, nicht als verfügbare Fähigkeit versprechen.
- **⚠️ Konflikt:** Steht einer DSH-Anweisung oder einer aktuellen Session-Regel entgegen. Nicht unverändert übernehmen.
- **◇ Zukunftskandidat:** Grundsätzlich denkbare Erweiterung, **keine bestätigte Roadmap**. Bis dahin im Prompt nicht erwähnen.

„Nicht vorhanden“ meint die **genannte Schnittstelle**, nicht automatisch das ganze Konzept. Welche Tools ein DSH-Agent tatsächlich erhält, hängt zusätzlich von Profil, Plugins und Session ab.

## Kritische Punkte: in der DSH-Fassung behoben

- [x] **⚠️ Identität:** Alle drei Texte beginnen mit „You are Codex“. DSH definiert seine eigene Identität im [System-Prompt-Service](<C:/Users/pasca/Coding/deepseek-harness/packages/core/system-prompt/src/index.ts#L421-L443>). **DSH-Fassung:** Kein zweiter Agentenname; nur die gewünschten Modelleigenschaften übernehmen.
- [x] **⚠️ Freigaben und Sicherheit:** Codex beschreibt implizite Autorisierung, wann Nutzererlaubnis nötig sei, und ein „approval auto-review block“. DSH entscheidet Freigaben über die tatsächliche [Approval-Policy](<C:/Users/pasca/Coding/deepseek-harness/docs/subsystems/approval.md#L21-L46>) und seine Tools; die Policy kann `never` sein. **DSH-Fassung:** Keine eigenen Freigaben aus dem Codex-Text ableiten; aktuelle DSH-Policy und explizite Nutzeranweisungen respektieren. Der Text selbst kann technische Sperren nicht aufheben, aber das Modell zu falschen Annahmen verleiten.
- [x] **⚠️ Dateisuche und Ausführung:** Codex empfiehlt `rg`/`rg --files`, `functions.exec`, `exec_command` und JavaScript-`Promise.allSettled` innerhalb dieses Tools. In dieser DSH-Session gelten `glob`, `grep`, `read`, `pwsh` und gegebenenfalls `multi_tool_use.parallel`; ein `functions.exec` gibt es nicht. **DSH-Fassung:** Zweck (effizient suchen, unabhängige Schritte parallelisieren, Shell-Escaping prüfen) behalten, konkrete DSH-Tools verwenden. [DSH-Dateisuche](<C:/Users/pasca/Coding/deepseek-harness/packages/fs/tool-fs-search/src/grep.ts#L285>).
- [x] **⚠️ Tests:** Auch Astra vermeidet unnötige Tests für triviale Änderungen und fordert passende Pflichtprüfungen; Sol begrenzt ebenfalls neue Tests und Wiederholungen. **Luna verbietet im Original Tests ohne Nutzerbitte.** **DSH-Fassung nach Nutzerentscheidung:** Diese Abstufung bleibt sinnvoll erhalten: Luna schreibt grundsätzlich wenig neuen Code, bearbeitet nur kleine, risikoarme Implementierungen und nutzt bevorzugt vorhandene Prüfungen. Nötige neue Checks müssen minimal und durch den tatsächlichen Vertrag begründet sein. Pflichtprüfungen gelten weiter; komplexe Testentwicklung oder kritische Änderungen werden abgegeben statt erfunden. [Sol](<C:/Users/pasca/Coding/codex/codex-rs/models-manager/models.json#L249>) · [Luna](<C:/Users/pasca/Coding/codex/codex-rs/models-manager/models.json#L417>).
- [x] **⚠️ Datei-Links:** Codex fordert `[app.py](/abs/path/app.py:12)` und verbietet Zeilenbereiche. Unsere Ausgabe verwendet verlinkte Pfade mit `#L24` bzw. `#L24-L30`. **DSH-Fassung:** Den hier geltenden Link-Vertrag beibehalten; Codex-Syntax streichen.
- [x] **⚠️ Autonomie:** „Persist until … complete“ ist als Arbeitsprinzip brauchbar, darf aber keine Session-Grenzen, Abbruchwünsche, Berechtigungen oder explizite Nur-Lesen-Aufträge verdrängen. **DSH-Fassung:** Vorhandene [Goal-Tools](<C:/Users/pasca/Coding/deepseek-harness/packages/goal/tool-goal/src/index.ts#L208-L235>) bei längeren Aufgaben nutzen; nicht ungefragt PRs/Worktrees erzeugen.

## Abschnitt-für-Abschnitt: Was übernehmen wir?

| Bereich im Codex-Template | Einordnung in DSH | Entscheidung für einen DSH-Prompt |
| --- | --- | --- |
| `# Personality`, `## Writing style` | ✅ Klarheit, Ton, Selbstständigkeit und verständliche Erklärungen funktionieren hier. Astra hat zusätzlich `## Technical communication` und PR-Schreibtipps. | Verhalten knapp und modellbezogen übernehmen; PR-Tipps nur bei einer PR-Aufgabe. |
| `# When to ask the user for permission` | ⚠️ Allgemein sinnvoll, aber Codex-spezifische Annahmen über Autorisierung/Auto-Review sind nicht unsere Policy. | Nur „frage bei wirklich fehlenden Entscheidungen“ übernehmen; Freigaben DSH überlassen. |
| `# Autonomy and persistence` | 🔁 DSH kennt fortsetzbare Sessions und Goals; Codex-Beispiele nennen auch Worktrees, Merge-Konflikte und Draft-PRs. | Initiative ja, konkretes Git-/PR-Verhalten nur bei Auftrag und verfügbaren Tools. |
| `# Working with the user` / `## Intermediate commentary` | 🔁 `commentary` und `final` gibt es auch hier. Codex nennt aber `functions.request_user_input_async` und bei Sol/Luna `functions.send_user_message_async`; die genauen Tools gibt es hier nicht. | Für Rückfragen das [DSH-Tool `ask_user_question`](<C:/Users/pasca/Coding/deepseek-harness/packages/interaction/tool-ask-user/src/index.ts#L16-L21>) nutzen; Fortschritt normal im `commentary`-Kanal, keine imaginäre Async-Nachrichten-API oder feste 30-/60-Sekunden-Pflicht. |
| `## Final answer`, `### Formatting rules` | ✅/⚠️ Ergebnis verständlich berichten passt; Link-Syntax, Formatpflichten und pauschales Verbot von Zeilenbereichen kollidieren. | Aussageprinzip übernehmen, Host-Formatregeln beibehalten. |
| `### Visualizations` | 🔁 Tabellen/Diagramme sind als Erklärung nützlich; „bevorzuge interaktive Visualisierungen“ verspricht keinen vorhandenen Renderer oder Toolzugang. | Nur bei inhaltlichem Nutzen und tatsächlich verfügbarer Ausgabeform visualisieren. |
| `# Rules for getting work done` | 🔁/⚠️ Vorsicht beim Quoting, sinnvolle Checks, gebündelte unabhängige Schritte passen; `functions.exec`, `rg`, `exec_command` und Lunas Testverbot nicht. | Workflow in DSH-Toolnamen und aktuelle Testregel übersetzen. |
| GitHub-/PR-Befehle innerhalb der Arbeitsregeln | 🔁 `gh --body-file` ist ein Codex-Beispiel, kein eingebautes DSH-PR-Tool. Shell-Aufrufe und ein optionaler [GitHub-Review-Eingang](<C:/Users/pasca/Coding/deepseek-harness/docs/user/guide/github-review.md#L66-L102>) sind etwas anderes als das Recht, PRs zu veröffentlichen. | Nur bei explizitem PR-Auftrag und tatsächlich verfügbarem CLI/Connector erwähnen. |
| `# Using skills` | 🔁 DSH hat Skills, aber der Modellschnittpunkt heißt [`skill`](<C:/Users/pasca/Coding/deepseek-harness/packages/skill/tool-skill/src/index.ts#L127-L161>); `ctx.skills.list()` ist ein **interner Host-Service**, nicht Codex' Modell-Tools `skills.list`/`skills.read`. | Vorhandenen Katalog und das verfügbare Skill-Tool verwenden; Codex-Aliase/Orchestrator-Aufrufanweisungen entfernen. |
| `# Apps (Connectors)` | ⛔ Codex-`app://`-Links, `codex_apps` und `tool_search` sind keine DSH-App-Oberfläche. 🔁 DSH hat **optional konfigurierte MCP-Server**, nicht automatisch Codex-Apps. | Codex-App-Anleitung streichen. Für einen wirklich konfigurierten MCP-Server nur dessen sichtbare Tools beschreiben. [DSH-MCP-Konfiguration](<C:/Users/pasca/Coding/deepseek-harness/docs/subsystems/mcp.md#L21-L45>). |
| `# Plugins` / `## How to use plugins` | 🔁 „Plugin“ ist bei DSH ein Cordis-Bundle/Plugin, nicht automatisch ein Codex-Paket aus Skills, Apps und MCP; Codex-Präfixe `plugin_name:` und `mcp__server__tool` gelten nicht pauschal. | Cordis-Inspect und Plugin-Manager nur nennen, wenn der Agent diese Tools tatsächlich besitzt. [DSH-Plugin-Manager](<C:/Users/pasca/Coding/deepseek-harness/packages/boot/plugin-manager/src/tools.ts#L20-L43>). |

**Wichtige Nuance bei MCP:** DSH kann bei entsprechend konfiguriertem Server sogar eigene Tools namens [`list_mcp_resources` und `list_mcp_resource_templates`](<C:/Users/pasca/Coding/deepseek-harness/packages/mcp/mcp-resources/src/tools.ts#L31-L59>) bereitstellen. Codex' pauschales „nicht zusätzlich aufrufen“ gehört trotzdem nicht in unseren Prompt: Verfügbarkeit und Zweck werden vom konkreten DSH-Profil bestimmt.

## Tatsächlich fehlend, aber als spätere Produktidee denkbar

| Codex-Erwartung | Heute | Denkbar, falls es einen konkreten Bedarf gibt |
| --- | --- | --- |
| `app://…`-Erwähnungen lösen eine App aus; `codex_apps` + `tool_search` finden App-Tools. | ⛔ Kein gleichwertiger Codex-App-Connector. MCP-Server und Cordis-Plugins decken **andere** Integrationen bereits ab. | ◇ Ein DSH-eigenes App-Verzeichnis/Triggerformat; **nicht** die Codex-Syntax versprechen oder einfach nachbauen. |
| `functions.send_user_message_async` liefert eine eigenständige Async-Nachrichtenaktion. | ⛔ Nicht als Modell-Tool belegt; `commentary`-Ausgaben sind vorhanden, aber etwas anderes. | ◇ Nur bei einem echten Anwendungsfall für gezielte Zwischen-Nachrichten ein DSH-Tool definieren. |
| `functions.exec` vereinheitlicht parallele Tool-Aufrufe und Skriptausführung. | ⛔ Dieser Name/dieses API-Modell fehlt; DSH hat Einzeltools und optional Parallel-/Workflow-Werkzeuge. | ◇ Keine neue API nötig, solange vorhandene Tools die Aufgaben erfüllen. |
| Interaktive Visualisierungen werden bevorzugt. | ⛔ Keine allgemeine, vom Codex-Text garantierte interaktive Visualisierungsfähigkeit. Bildgenerierung/Bildanzeige sind separate, verfügbarkeitsabhängige Tools und kein genereller Diagramm-Renderer. | ◇ Spezifische Darstellung bei klarem Bedarf als DSH-UI-Funktion bauen. |

„Fehlt“ ist **keine Anforderung**, die Funktion nachzubauen. Künftige Capability würde erst nach eigener Implementierung, Prüfung und Verfügbarkeit im jeweiligen Profil in einen Prompt aufgenommen.

## Modellunterschiede, die für die Übertragung zählen

| Modell | Eigenheiten im untersuchten Basistemplate |
| --- | --- |
| Astra | Längster Text; eigene ausführliche Technik-/PR-Kommunikation und stärker formulierte Handlungsinitiative. `functions.request_user_input_async` wird genannt, `functions.send_user_message_async` im **Basistemplate nicht**. |
| Sol | Stil/Plugin-/App-/Skill-Abschnitte fast identisch zu Luna; geringfügig stärkere Freigabe-Fortsetzungsregel und differenzierte Hinweise, wann Tests nicht nötig sind. |
| Luna | Wie Sol, **aber ausdrückliches Verbot ungefragter Tests**. Als schmaleren Arbeitsrahmen mit wenigen neuen Tests übertragen, nicht als Verbot erforderlicher Verifikation. Die Begrenzung auf kleine, unkritische Implementierungen ist eine bewusste DSH-Anpassung nach Nutzerwunsch, keine Originalaussage. |

Codex speichert neben dem Template weitere Felder wie `persistent_instructions`, `approvals`, `tools` und `collaboration_modes`; beispielsweise stehen [`persistent_instructions` und `tools` bei Sol separat](<C:/Users/pasca/Coding/codex/codex-rs/models-manager/models.json#L250-L260>). **Das Plugin kopiert diese Zusatzfelder nicht.** Insbesondere `clock.sleep` stammt aus den separaten Persistent-Instructions und gehört **nicht** zu den hier geprüften Basistemplates. Codex kann außerdem serverseitige Instruktionen haben, die dieser Checkout nicht offenlegt.

## Ergebnis des zweiten Passes

Die [Promptquelle](<dsh-codex-subscription/src/codex-base-prompts.js>) besteht aus gemeinsamen DSH-Leitlinien und je einem expliziten Abschnitt für Astra, Sol und Luna. Daraus werden drei vollständige Texte zusammengestellt; keine Laufzeit-Filterung fremder Prosa und keine neue Abhängigkeit.

| Modell | DSH-Arbeitsrahmen | Erhaltener Stil |
| --- | --- | --- |
| Astra | Komplexe Aufgaben Ende zu Ende verstehen, umsetzen und angemessen prüfen; vorhandene Tests nutzen, unnötige Tests vermeiden. | Warm, direkt, zusammenhängende Erklärung; technische Evidenz, nachvollziehbare Ergebnisse und konkrete PR-Beschreibungen bei entsprechendem Auftrag. |
| Sol | Klar abgegrenzte, auch mehrstufige Implementierungen; vorhandene Muster, kleine vollständige Änderungen und gezielte Checks. | Kollegial, einfach und konkret; Ergebnis vor Arbeitschronik, Fehler korrigieren statt nur bestätigen. |
| Luna | Kleine, lokale, risikoarme Änderungen; wenig neuer Code und möglichst vorhandene Checks. Kritische/umfangreiche Implementierungen sowie komplexe Testentwicklung an ein geeignetes stärkeres Modell abgeben. | Kurz, verständlich und ehrlich über Unsicherheit; kein Qualitätsersatz durch viel generierten Code oder erfundene Tests. |

**Autonomie bleibt bei allen drei erhalten:** Innerhalb des erlaubten Rahmens weiterarbeiten, bis das gewünschte Ergebnis samt nötiger Prüfung vorliegt; Routineentscheidungen selbst treffen, Korrekturen aufnehmen, nach Kompaktierung anhand vorhandener Aufzeichnungen fortsetzen. Keine künstlichen Nachfragen an jedem Schritt und keine erfundenen Zusatzaufträge. DSH-Modus, Abbruchwünsche, Freigaben und Sicherheitsgrenzen bleiben maßgeblich. Eine Übergabe durch Luna ist keine automatische Modellumschaltung; wenn kein erlaubter Übergabeweg verfügbar ist, wird die konkrete Grenze benannt und der Nutzer um Fortsetzung mit einem stärkeren Modell gebeten.

- [x] Eigene Identität und tatsächliche DSH-Toolverträge bleiben erhalten; genannte Tools sind verfügbarkeitsabhängig.
- [x] Kommunikationsstil, Urteilskraft, zielgerichtete Autonomie, ressourcensparende Arbeit und sichere Shell-Nutzung aus den Originalen übernommen.
- [x] DSH-Dateisuche, Linksystem, Skillkatalog, Plugin-/MCP-Verfügbarkeit und aktuelle Policy statt Codex-Mechanismen.
- [x] Nur exakt `gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna`; andere Modelle und Provider bekommen keinen Zusatz.
- [x] Rohtexte aus dem Online-Katalog werden nicht übernommen, auch nicht nach Refresh, Fehler oder Kontowechsel. Fähigkeiten werden weiterhin aktualisiert.
- [x] Der Zusatz bleibt abschaltbar und additiv; bestehende Abschnitte, Laufzeitkontexte, Variablen und Tools bleiben erhalten. Ein Preset mit `complete: true` kann zusätzliche Abschnitte unterdrücken; siehe [DSH-Prompt-Assembly](<C:/Users/pasca/Coding/deepseek-harness/packages/core/system-prompt/src/index.ts#L596-L634>).
- [x] [Prompt-Inhaltschecks](<dsh-codex-subscription/tests/codex-base-prompts.test.mjs>), [Katalogtests](<dsh-codex-subscription/tests/model-catalog.test.mjs>) und [Integrationstests](<dsh-codex-subscription/tests/plugin-integration.test.mjs>) sichern die Auswahl und Grenzen strukturell ab.

**Prüfgrenze:** Die Modellabstufung ist eine Verhaltensanweisung, keine technische Sicherheitsbarriere. Text- und Integrationstests sowie eine unabhängige Textprüfung beweisen nicht, dass ein reales Modell immer folgt. Live-Modellverhalten und Darstellung in der laufenden GUI sind damit nicht verifiziert; die Produktionsinstallation wurde nicht verändert.
