# Rift Companion Full Product Design

## Status

Freigegebene Zielarchitektur fuer den Ausbau des vorhandenen Tauri-Prototyps in drei aufeinanderfolgenden, jeweils lauffaehigen Windows-Releases.

## Ziel

Rift Companion wird ein lokaler Gaming-Hub rund um den unveraenderten offiziellen Roblox-Client. Die Anwendung verwaltet Bibliothek, lokale Accountprofile, Sitzungen, Systemdiagnosen, Performance-Werkzeuge, Overlay, Screenshots, Discord-Praesenz und signierte Updates. Jede Stufe endet mit Tests, einer startbaren portablen EXE und einem deutsch/englisch lokalisierten NSIS-Installer.

## Unveraenderliche Sicherheitsgrenzen

- Rift liest, speichert, importiert und uebertraegt keine Roblox-Passwoerter oder `.ROBLOSECURITY`-Cookies.
- Rift patcht keine Roblox-Dateien und veraendert keine FastFlags.
- Rift injiziert keine DLLs, hookt keine Grafik-API und liest keinen Roblox-Prozessspeicher.
- Rift erzeugt keine Gameplay-Eingaben, Makros, Cheats oder Exploits.
- Roblox wird ausschliesslich ueber offizielle Roblox-HTTPS-Links oder validierte `roblox://`-Protokoll-URLs gestartet.
- Lokale Accountprofile beschreiben das vom Nutzer gewuenschte Konto. Rift behauptet niemals, das tatsaechlich angemeldete Roblox-Konto erkannt zu haben.
- Prozessbeendigung und Windows-Aenderungen erfolgen nur nach sichtbarer Auswahl und ausdruecklicher Bestaetigung.
- Nicht sicher oder zuverlaessig messbare Werte werden als `Nicht verfuegbar` dargestellt. Beispieldaten werden aus dem Produktions-Build entfernt.

## Release-Strategie

### Stufe 1: Core, Version 0.2.0

Stufe 1 ersetzt alle Mockdaten durch reale lokale Persistenz und Windows-Erkennung. Sie liefert das belastbare Fundament fuer die beiden folgenden Stufen.

### Stufe 2: Performance, Version 0.3.0

Stufe 2 fuegt zustimmungspflichtige Windows-Werkzeuge, Diagnosen, Sitzungsberichte und ein separates Overlay hinzu.

### Stufe 3: Comfort, Version 1.0.0

Stufe 3 liefert Serverkomfort, Discord Rich Presence, Screenshot-Bibliothek, erweiterte Statistiken und den signierten Updatefluss.

Die drei Stufen werden nacheinander implementiert. Eine spaetere Stufe darf die Sicherheitsgrenzen oder die Funktionsfaehigkeit einer frueheren Stufe nicht aufweichen.

## Architektur

### React-Oberflaeche

React und TypeScript bleiben fuer Navigation, Formulare, Diagramme, Dialoge, Themes und Overlay-Darstellung verantwortlich. Die Oberflaeche wird in Funktionsmodule fuer Dashboard, Bibliothek, Accounts, Performance, Statistik, Server, Screenshots und Einstellungen getrennt. Alle sichtbaren Texte kommen aus vollstaendigen deutschen und englischen Uebersetzungsdateien.

### Rust-Kern

Rust kapselt alle Betriebssystem- und Netzwerkgrenzen:

- Roblox-Installation und URI-Protokoll pruefen
- Roblox-Prozesse erkennen und Sitzungen ueberwachen
- CPU-, RAM-, Netzwerk- und verfuegbare GPU-Werte erfassen
- Windows-Energieprofil und Game Mode lesen
- freigegebene Hintergrundprogramme schliessen und wieder starten
- Overlay-Fenster steuern
- sichere Roblox- und HTTPS-Links oeffnen
- Screenshot-Ordner beobachten
- Discord IPC und Updatepruefung kapseln

Jeder Tauri-Befehl nimmt strukturierte, validierte Parameter entgegen. Freie Shell-Befehle oder vom Nutzer zusammengesetzte Kommandozeilen werden nicht akzeptiert.

### SQLite-Persistenz

Tauri SQL mit SQLite wird die einzige dauerhafte Produktdatenquelle. Migrationen sind versioniert und idempotent. Browser-Vorschauen verwenden einen In-Memory-Adapter mit derselben TypeScript-Schnittstelle; Produktionsdaten werden nicht mehr in `localStorage` gehalten.

Die Datenbank enthaelt mindestens folgende Tabellen:

- `app_profiles`: mehrere lokale Launcher-Konfigurationen
- `account_profiles`: Benutzername, Anzeigename, Initialen, optionale Avatar-URL, Farbe und Notiz
- `games`: Place-ID, Name, Beschreibung, Bild, Tags und letzter Start
- `collections` und `collection_games`: benutzerdefinierte Sammlungen
- `account_games`: Favorit, accountbezogene Spielzeit und letzte Nutzung
- `performance_profiles`: globale Vorlagen und accountbezogene Auswahl
- `sessions`: Start, Ende, Dauer, Place-ID, lokales Accountprofil und Ergebnis
- `session_samples`: Zeitreihe fuer CPU, RAM, GPU und Netzwerkdiagnose
- `activities`: Start- und Fehlerprotokoll
- `managed_programs`: explizit freigegebene Hintergrundprogramme und Wiederanlaufstatus
- `private_servers`: validierte offizielle Roblox-Links und Labels
- `screenshots`: Dateipfad, Erstellungszeit, Dimensionen, Spielzuordnung und Favorit
- `crash_reports`: erkannte Prozessabbrueche und erlaubte lokale Roblox-Logreferenzen
- `settings`: Sprache, Darstellung, Overlay, Discord und Updatekonfiguration

Fremdschluessel und eindeutige Constraints verhindern verwaiste Zuordnungen und doppelte Place-IDs innerhalb desselben Launcherprofils.

## Stufe 1: Core-Funktionen

### Roblox-Erkennung und Start

- Rift prueft den registrierten `roblox`-URI-Handler und bekannte Roblox-Installationspfade unter dem aktuellen Windows-Benutzer.
- Der Status unterscheidet `Bereit`, `Nicht gefunden`, `Wird ausgefuehrt` und `Pruefung fehlgeschlagen`.
- Place-IDs duerfen ausschliesslich aus 1 bis 20 ASCII-Ziffern bestehen.
- Spiel-URLs muessen HTTPS verwenden und zu `roblox.com` oder `www.roblox.com` gehoeren.
- Der Startdialog zeigt Spiel, Place-ID, gewuenschtes lokales Accountprofil und Performanceprofil.
- Der eigentliche Start erfolgt ueber `roblox://placeId=<id>`; Rift startet keine kopierte oder gepatchte Clientdatei.
- Jeder Startversuch erzeugt einen dauerhaften Aktivitaetseintrag mit Erfolg oder Fehlertext.

### Sitzungs- und Spielzeitmessung

- Nach einem Rift-Start beobachtet Rust Roblox-Prozesse in einem begrenzten Startfenster.
- Eine Sitzung beginnt, sobald ein passender Roblox-Prozess erscheint, und endet, wenn kein passender Prozess mehr laeuft.
- Mehrere Roblox-Prozesse werden als eine Sitzung behandelt; ein Prozessneustart innerhalb von 20 Sekunden setzt dieselbe Sitzung fort.
- Manuell gestartete Roblox-Sitzungen koennen als `Unbekanntes Spiel` erfasst werden, werden aber keinem lokalen Accountprofil automatisch zugeordnet.
- Spielzeit wird aus monotonen Zeitstempeln berechnet und nach Prozessende in SQLite geschrieben.
- Ein unerwartetes Prozessende wird als moeglicher Absturz markiert, ohne einen Absturz sicher zu behaupten.

### Lokale Accountprofile

- Profile koennen erstellt, bearbeitet, ausgewaehlt und geloescht werden.
- Ein Profil enthaelt Benutzername, lokales Label, Farbe, Notiz, Initialen und optional eine oeffentliche Avatar-URL.
- Das Loeschen eines Profils verlangt eine Bestaetigung und bietet an, zugeordnete Statistiken zu behalten oder zu entfernen.
- Favoriten, Sammlungsansicht, Spielzeit und aktives Performanceprofil werden pro Accountprofil gespeichert.
- Der offizielle Roblox-Accountwechsel und Quick Login werden als externe offizielle Roblox-Seiten geoeffnet.
- Vor jedem Start bestaetigt der Nutzer das beabsichtigte Profil. Das ist die Falsches-Konto-Warnung; eine technische Behauptung ueber den Roblox-Login wird nicht angezeigt.

### Bibliothek und Sammlungen

- Spiele koennen ueber Place-ID oder offiziellen Roblox-Link hinzugefuegt, bearbeitet und entfernt werden.
- Suche, Tags, Favoriten und Sammlungen arbeiten auf SQLite-Daten.
- Benutzerdefinierte Tags werden normalisiert, duplizierte Tags werden verhindert.
- Zuletzt gespielt und kumulierte Spielzeit stammen nur aus erfassten Sitzungen.
- Fehlen Online-Metadaten, bleiben manuell gepflegte Angaben erhalten.

### Hardware- und Systemanzeige

- CPU-Modell, logische Kerne, Gesamtspeicher und Betriebssystem werden aus Rust geliefert.
- CPU- und RAM-Auslastung werden regelmaessig aktualisiert.
- GPU-Name wird ueber Windows-Systeminformationen gelesen. GPU-Auslastung wird nur angezeigt, wenn ein unterstuetzter Windows-Leistungsindikator verfuegbar ist.
- Netzwerkdiagnose misst DNS-Aufloesung und TCP/HTTPS-Latenz zu einem konfigurierten Ziel. Sie wird nicht als Roblox-Ingame-Ping bezeichnet.
- Messfehler liefern einen typisierten Fehlerstatus und niemals erfundene Zahlen.

### Darstellung, Fonts und Sprache

- Eingebaute, offline gebuendelte Fonts: Inter, Geist, Poppins, Manrope, Rubik und JetBrains Mono.
- Ueberschriften- und Textfont sind getrennt waehlbar.
- Textskalierung reicht von 85 bis 125 Prozent.
- Gewichtsauswahl bietet 400, 500, 600 und 700, soweit der Font das Gewicht enthaelt.
- Abstandsmodi: kompakt, komfortabel und grosszuegig.
- Lokale `.ttf`, `.otf`, `.woff` und `.woff2` koennen importiert werden. Rift kopiert die Datei in sein App-Datenverzeichnis, prueft Groesse und Dateiendung und laedt sie nur in der eigenen WebView.
- Theme-Auswahl: dunkel, hell und Systemstandard.
- Akzentfarben koennen aus Presets oder ueber einen validierten Hex-Farbwert gewaehlt werden.
- Eigene Hintergrundbilder werden in das App-Datenverzeichnis kopiert und koennen entfernt werden.
- App-Sprachen: Deutsch und Englisch. Die Auswahl wird lokal gespeichert und wirkt ohne Neustart.

### Installer-Sprachauswahl

- Der NSIS-Installer enthaelt die Tauri-Sprachen `German` und `English`.
- `displayLanguageSelector` ist aktiviert, sodass die Sprachauswahl vor der ersten Installationsseite erscheint.
- Alle Installerseiten, Abbruchdialoge und Deinstallationsseiten verwenden die ausgewaehlte Sprache.
- Der Installer arbeitet im `currentUser`-Modus und benoetigt standardmaessig keine Administratorrechte.
- Deutsch und Englisch werden durch zwei unbeaufsichtigte Installer-Buildpruefungen und einen sichtbaren manuellen Durchlauf verifiziert.
- Die Sprache des Installers und die App-Sprache sind unabhaengig. Beim ersten App-Start wird die Windows-Sprache verwendet; danach gilt die App-Auswahl.

### Stufe-1-Abnahme

- Keine sichtbare Seite zeigt Mock-Hardware oder Mock-Sitzungen.
- Ein angelegtes Profil, Favorit, Font und Theme bleiben nach Neustart erhalten.
- Ein Roblox-Start erzeugt Aktivitaet; ein erkannter Prozess erzeugt eine abgeschlossene Sitzung mit realer Dauer.
- Alle Eingaben werden mit positiven und negativen Tests abgedeckt.
- Deutscher und englischer Installer bauen erfolgreich und zeigen die Sprachauswahl.
- `Rift-Companion-0.2.0-Setup.exe` und `Rift-Companion-0.2.0-Portable.exe` werden im Ausgabeordner erzeugt.

## Stufe 2: Performance-Funktionen

### Performanceprofile

- Performance, Ausgeglichen und Qualitaet bleiben Empfehlungsvorlagen.
- Profile speichern Zielbildrate, empfohlene Roblox-Grafikstufe, Overlay-Sichtbarkeit, Diagnoseintervall und Programmrichtlinie.
- Rift schreibt keine Roblox-Konfigurationsdateien. Empfehlungen werden erklaert und koennen als Checkliste bestaetigt werden.

### Windows-Energieprofil und Game Mode

- Der aktive Energieplan wird ueber eine strukturierte Windows-Schnittstelle oder `powercfg` mit festen Argumenten gelesen.
- Ein Wechsel ist nur auf eine aus Windows ausgelesene GUID moeglich und verlangt eine Bestaetigung.
- Rift speichert den vorherigen Plan und kann ihn nach der Sitzung wiederherstellen.
- Game Mode wird gelesen. Rift bietet einen direkten Link zur passenden Windows-Einstellungsseite, schreibt den Registry-Wert aber nicht verdeckt.

### Hintergrundprogramme

- Rift zeigt nur Prozesse des aktuellen Benutzers mit Anzeigename, Speicherverbrauch und sicher aufloesbarem Programmpfad.
- System-, Sicherheits-, Treiber-, Roblox- und Rift-Prozesse sind von der Beendigung ausgeschlossen.
- Der Nutzer erstellt eine explizite Allowlist und bestaetigt jeden Schliessvorgang.
- Nur Programme mit validiertem absolutem Pfad koennen nach der Sitzung neu gestartet werden; freie Argumente werden nicht gespeichert.
- Fehlgeschlagene Beendigungen oder Neustarts erscheinen im Sitzungsbericht.

### Netzwerk- und Crashdiagnose

- Ein Netzwerkcheck prueft DNS, Verbindungsaufbau und HTTPS-Antwortzeit getrennt.
- Ergebnisse enthalten Ziel, Zeitpunkt, Messdauer und Fehlerklasse.
- Rift beobachtet neue Dateien in erlaubten Roblox-Logordnern lesend und speichert nur Pfad, Zeit, Groesse und eine kurze lokal erzeugte Zusammenfassung.
- Logdateien und potenziell personenbezogene Inhalte werden nie automatisch hochgeladen.

### Sitzungsbericht

- Berichtsfelder: Dauer, durchschnittliche und maximale CPU-Auslastung, durchschnittlicher und maximaler Rift/Roblox-RAM-Verbrauch, verfuegbare GPU-Messwerte, Netzwerkdiagnose und erkannte Fehler.
- FPS und Ingame-Ping sind nullable. Ohne einen sicheren externen Messanbieter steht `Nicht verfuegbar`.
- Berichte koennen als JSON und CSV exportiert werden.

### Overlay

- Das Overlay ist ein separates Tauri-Fenster, niemals ein Hook im Roblox-Prozess.
- Es ist immer im Vordergrund, verschiebbar, skalierbar und ueber einen sichtbaren Schalter klickdurchlaessig.
- Anzeigen: Uhrzeit, Sitzungsdauer, CPU, RAM, verfuegbare GPU-Auslastung, Mikrofonstatus und Aufnahmeindikator.
- Mikrofon- und Aufnahmeindikatoren spiegeln nur vom Nutzer konfigurierte lokale Statuswerte; Rift zeichnet nicht selbst auf.
- Das Overlay zeigt FPS oder Ingame-Ping nur, wenn ein spaeterer sicherer Anbieter einen validierten Wert liefert.
- Ein globales Tastenkurzel kann das Overlay ein- und ausblenden und ist in den Einstellungen aenderbar.

### Stufe-2-Abnahme

- Windows-Statuspruefungen funktionieren ohne Administratorrechte im Lesemodus.
- Jede veraendernde Aktion verlangt eine Bestaetigung und kann anhand des Protokolls nachvollzogen werden.
- Ein ausgewaehltes Testprogramm wird beendet und ueber seinen validierten Pfad wieder gestartet; ausgeschlossene Prozesse werden abgewiesen.
- Das Overlay bleibt neben Roblox eigenstaendig und beendet sich sauber mit Rift.
- `Rift-Companion-0.3.0-Setup.exe` und `Rift-Companion-0.3.0-Portable.exe` werden erzeugt.

## Stufe 3: Komfort und Community

### Server-Browser und Rejoin

- Rift verwendet ausschliesslich oeffentliche Roblox-Endpunkte auf Roblox-Domains und sendet keine Cookies.
- Die Serverliste zeigt Server-ID, Spielerzahl, Kapazitaet und Pagination, sofern der Endpunkt diese Daten liefert.
- Sortierung nach Spielerzahl geschieht lokal und veraendert die Antwort nicht.
- Server-IDs werden streng validiert, bevor ein offizieller Join-Link geoeffnet wird.
- Rejoin startet den zuletzt bekannten Place und, falls sicher vorhanden, dieselbe validierte Server-ID. Andernfalls startet es nur den Place.
- API-Fehler, Rate Limits und nicht verfuegbare Server fuehren zu einem sichtbaren, wiederholbaren Fehlerzustand.

### Private Server

- Rift speichert nur offizielle HTTPS-Links auf Roblox-Domains.
- Linkcode und Typ werden geprueft; unbekannte Queryparameter werden beim Speichern verworfen.
- Oeffnen erfolgt ueber den Standardbrowser beziehungsweise den offiziellen Roblox-Handler.

### Discord Rich Presence

- Discord Rich Presence ist standardmaessig aus und wird pro lokalem Accountprofil konfiguriert.
- Der Nutzer traegt eine numerische Discord Application ID ein. Rift speichert keinen Discord-Token.
- Bei laufendem Discord-Desktopclient zeigt Rift Spielname, Sitzungsdauer und lokales Profil-Label.
- Beim Sitzungsende oder Deaktivieren wird die Presence geloescht.
- Fehlt Discord oder ist die Application ID ungueltig, bleibt Rift funktionsfaehig und zeigt einen lokalen Fehlerstatus.

### Screenshot-Bibliothek

- Nutzer koennen vorhandene Bildordner hinzufuegen und einzelne PNG-, JPEG- oder WebP-Dateien importieren.
- Ein Dateiwatcher erkennt neue Bilder in freigegebenen Ordnern.
- Rift speichert Pfad, Zeit, Dimensionen, optionales Spiel, Tags und Favorit, aber dupliziert Originalbilder nicht ungefragt.
- Vorschaubilder werden in einem eigenen Cache erzeugt; fehlende Originale werden als `Datei verschoben` markiert.
- Galerie bietet Suche, Spiel- und Datumsfilter, Favoriten, Ordner oeffnen und Metadaten entfernen.

### Erweiterte Statistiken

- Ansichten fuer Woche, Monat, Spiel, lokales Accountprofil und Launcherprofil.
- Kennzahlen stammen ausschliesslich aus gespeicherten Sitzungen.
- Leere Zeitraeume zeigen einen Empty State, keine Division durch null und keine Beispieldaten.
- Export als CSV und JSON verwendet die aktuell gefilterte Ansicht.

### Signierte Updates

- Tauri Updater prueft ein HTTPS-Manifest und akzeptiert nur mit dem eingebetteten oeffentlichen Schluessel signierte Pakete.
- Automatische Pruefung erfolgt einmal beim Start und danach hoechstens alle 24 Stunden.
- Download und Installation brauchen eine sichtbare Nutzerbestaetigung; Fortschritt und Fehler werden angezeigt.
- Der private Signaturschluessel wird nie in Quellcode, Installer, Datenbank oder Ausgabeordner aufgenommen.
- Ohne konfigurierten Release-Endpunkt meldet die App `Updatequelle nicht eingerichtet` und bleibt voll nutzbar.
- Der Updatefluss wird vor Veroeffentlichung gegen einen lokalen HTTPS-Testendpunkt mit gueltiger und ungueltiger Signatur geprueft.
- Fuer echte GitHub-Releases wird die vom Nutzer bereitgestellte Repository-Adresse als Buildkonfiguration gesetzt; das Repository hostet `latest.json`, Installer und Signatur.

### Stufe-3-Abnahme

- Serverlistenfehler und Rate Limits lassen die App nicht abstuerzen.
- Rejoin und private Links oeffnen ausschliesslich validierte offizielle Ziele.
- Discord Presence wird gesetzt und geloescht, wenn ein gueltiger Application-ID-Testwert und Discord Desktop vorhanden sind.
- Neue Screenshots erscheinen ohne App-Neustart in der Galerie.
- Wochen- und Monatsstatistiken stimmen mit den SQLite-Sitzungsdaten ueberein.
- Der lokale signierte Updatetest akzeptiert das gueltige Paket und weist ein manipuliertes Paket ab.
- `Rift-Companion-1.0.0-Setup.exe` und `Rift-Companion-1.0.0-Portable.exe` werden erzeugt.

## Fehlerbehandlung

- Rust gibt typisierte Fehlercodes und nutzerfreundliche deutsche/englische Nachrichten zurueck.
- UI-Aktionen zeigen Lade-, Erfolgs-, Leer- und Fehlerzustand.
- Hintergrundueberwachung verwendet begrenzte Intervalle und wird beim App-Ende sauber beendet.
- SQLite-Transaktionen schuetzen Mehrtabellen-Aenderungen.
- Netzwerkzugriffe haben Timeouts, begrenzte Wiederholungen und keine Endlosschleifen.
- Ein Fehler in Discord, Update, Serverliste, Screenshot-Watcher oder Overlay darf Kernstart und Bibliothek nicht blockieren.

## Berechtigungsmodell

- Tauri-Capabilities werden pro Fenster und Plugin auf das notwendige Minimum begrenzt.
- Dateizugriff beschraenkt sich auf App-Daten, explizit ausgewaehlte Fonts, Bilder, Exportziele und freigegebene Screenshot-Ordner.
- Externe URLs werden gegen Protokoll- und Host-Allowlists geprueft.
- Prozessaktionen akzeptieren eine PID nur zusammen mit erneut geprueftem Prozessnamen, Benutzer und Pfad.
- Sensible Werte erscheinen nicht in Logs.

## Teststrategie

### TypeScript

- Parser, Validierung, Reducer und Datenadapter werden mit Vitest getestet.
- Jede Seite hat Interaktionstests fuer Erfolg, leere Daten und Fehler.
- Uebersetzungs-Tests stellen identische Schluessel in Deutsch und Englisch sicher.
- Accessibility-Tests pruefen Namen, Fokus und Dialogsemantik.

### Rust

- Place-ID-, URL-, Pfad-, PID- und Server-ID-Validierung wird mit Unit Tests abgedeckt.
- Systemanbieter werden ueber Traits isoliert und mit deterministischen Testanbietern geprueft.
- SQLite-Migrationen laufen gegen temporaere Datenbanken.
- Sitzungszustandsautomat, Prozess-Allowlist und Neustartlogik erhalten Grenzfalltests.

### Integration

- Tauri-Command-Vertraege werden zwischen TypeScript und Rust getestet.
- Ein kontrollierter Testprozess simuliert Roblox-Start und -Ende.
- Screenshot-Watcher, Discord-Fehlerpfad und Update-Signaturpruefung erhalten Integrationstests.
- Playwright prueft alle Hauptseiten bei 1440 x 900 und 1024 x 720 sowie das Overlay.
- Vor jedem Release laufen Frontendtests, Rusttests, Produktions-Build, NSIS-Build und echter EXE-Starttest.

## Ausdruecklich nicht enthalten

- Roblox-Client-Modifikationen, Roblox-Font-Ersetzung und Shader-Injection
- FPS-Unlocker, FastFlags oder Speicherinspektion
- automatischer Roblox-Login oder echtes Account-Switching
- Behauptung, das aktuell angemeldete Roblox-Konto erkannt zu haben
- Gameplay-Makros oder automatische Eingaben
- automatische Cloud-Synchronisierung; Export und Import bleiben lokal, bis ein separater Dienst mit eigener Sicherheitspruefung spezifiziert wird

## Vollstaendige Definition of Done

Das Gesamtziel ist erst erreicht, wenn alle Abnahmepunkte der drei Stufen nachweisbar erfuellt sind, keine Produktionsseite Mockwerte zeigt, Deutsch und Englisch vollstaendig sind, der Installer eine funktionierende Sprachauswahl besitzt, alle automatisierten Tests gruen sind und die finalen Version-1.0.0-Dateien im Ausgabeordner real gestartet beziehungsweise installiert werden koennen.
