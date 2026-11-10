# Virtual Stadium Experience – Prototyp

Digitale Stadionvorschau für Rollstuhlfahrende. Schulprojekt ÜK 368 (LB Element c) von Giuliano und Kimi.

**Wichtig:** Alle Wege, Plätze, Masse und Angaben sind simuliert. Es sind keine offiziellen Informationen zum Stadion San Siro. Es gibt keinen Ticketverkauf und keine Verbindung zur UEFA oder zu Fussballverbänden.

## Was der Prototyp kann

Die Testperson ist Edi (18, Albanien-Fan, manueller Rollstuhl 68 × 110 cm). Sein Freund Maxim begleitet ihn.

1. **Ankunft** – Edi steht auf dem Rollstuhl-Parkplatz. Die Testperson fährt selbst über den Vorplatz (Foodtrucks, Tram, Fans, Ordner) bis vor die drei Eingänge.
2. **Route** – Drei Routen mit Daten (Breite, Stufen, Lift). Die Testperson entscheidet selbst. A (Drehkreuz 60 cm) und B (2 Stufen) enden an einem Hindernis. C führt über Rampe und Lift (Kabine 110 × 140 cm) auf Ebene 2.
3. **Platz** – Drei Rollstuhlplätze mit echter 3D-Sicht: Unterring hinter Geländer, erhöhte Plattform, Ecke beim Kamerapodest. Fans sitzen oder stehen lassen. Sichtqualität wird erst nach der Wahl gezeigt.
4. **Service** – Weg zum barrierefreien WC selbst fahren, Fluchtweg anzeigen, Hilfe & Notfall.
5. **Ticket** – Ticketvorschau (simuliert) und Stadionpass als Bild zum Speichern.

Dazu: **Frei erkunden** (8 Bereiche über die Karte), **Hilfe & Notfall** jederzeit oben rechts, **Karte** (oben, schliesst auch mit Esc), unter **Optionen** Ton, Kamera (Ego / Third-Person), Atmosphäre (vor dem Spiel / im Spiel), Sprache (Deutsch / Englisch) und Bedienung ausblenden, **Testprotokoll** mit Zeitstempeln (Startseite unten).

## Bedienung

| Aktion | Maus / Touch | Tastatur |
|---|---|---|
| Fahren | «Fahren» gedrückt halten | `W` oder `↑` halten |
| Zurückfahren | «Zurück» gedrückt halten | `S` oder `↓` halten |
| Automatisch fahren / Pause | «Automatisch fahren» | Leertaste |
| Schneller fahren | – | `Shift` halten |
| Umsehen | Ziehen bzw. Wischen | `←` `→` bzw. `A` `D` |
| Blick zurücksetzen | – | `R` |
| Ego / Third-Person | Optionen → Kamera | `V` |
| Vor dem Spiel / im Spiel | Optionen → Atmosphäre | `M` |
| Bedienung aus-/einblenden | Optionen → Bedienung anzeigen | `H` |
| Karte öffnen | «Karte» oben oder kleine Karte | – |
| Karte, Optionen, Fenster schliessen | Schliessen | `Esc` |

Für die Testleitung: Die fünf Striche unter dem Schrittnamen oben lassen sich anklicken, um direkt zu einem Schritt zu springen.

## Auf Vercel veröffentlichen

1. Alle Dateien dieses Ordners ins GitHub-Repository hochladen (alles im Hauptordner, ohne Unterordner).
2. Vercel baut jede neue Version automatisch (Build: `npm run build`, Output: `dist`).
3. Link im privaten Browserfenster und auf dem Smartphone testen.

## Lokal starten (optional)

Benötigt Node.js 18 oder neuer.

```bash
npm install
npm run dev
```

## Projektstruktur

Alle Dateien liegen bewusst im Hauptordner (einfacher Upload über die GitHub-Webseite).

```
index.html       Seitenaufbau (Startseite, Tour, Hilfe, Hinweise)
main.js          Ablauf der Tour, Bedienung, Renderloop
main.css         Gestaltung
i18n.js          Texte Deutsch / Englisch
config.js        Masse des simulierten Stadions, Qualitätsstufe
layout.js        Eingänge, Routen, Plätze, Wege, Bereiche (eine Datenquelle für 3D und Karte)
stadium.js       Stadion: Ränge, Fassade, Dach, Türme, Flutlicht, Bildschirme
interior.js      Zaun, Eingänge, Rampe, Lift, WC, Hilfepunkte, Rollstuhlplätze
surroundings.js  Himmel, Vorplatz, Tram, Parkplatz, Foodtrucks, Bäume, Stadt
crowd.js         Publikum und Spieler
avatar.js        Edi im Rollstuhl, Maxim, Ordner
drive.js         Fahren entlang der Wege
camera.js        Kamera (Überblick, Kamerafahrt, Folgen, Umsehen)
map.js           Stadionkarte
textures.js      selbst gezeichnete Texturen und Schilder
geometry.js      Hilfsfunktionen für die Stadionform
renderer.js      Renderer und Leuchteffekt (Bloom)
perf.js          Bildrate messen, Auflösung anpassen, Shader vorab laden
audio.js         Stadionatmosphäre (im Browser erzeugt)
log.js           Testprotokoll
pass.js          Stadionpass als Bild
toast.js         Fehlermeldungen
```

## Grafikstufen und Performance messen

Auf Smartphones und schwächeren Geräten läuft automatisch die reduzierte Grafikstufe. Wird es trotzdem ruckelig, rechnet die Szene automatisch mit etwas kleinerer Auflösung.

| Adresse | Wirkung |
|---|---|
| `?quality=low` / `?quality=high` | Grafikstufe erzwingen |
| `?bloom=0` / `?bloom=1` | Leuchteffekt (Bloom) aus- oder einschalten (Standard: an in «high», aus in «low») |
| `?adaptive=0` | automatische Auflösungsanpassung aus (für faire Vergleichsmessungen) |
| `?perf` | Messanzeige mit Bildrate, Frame-Zeiten, Auflösung, Zeichenaufrufen und Dreiecken. «10-s-Messung» schreibt das Ergebnis ins Testprotokoll. |

Beispiel für einen Vergleich auf demselben PC: `…/?perf&adaptive=0&quality=high`, `…/?perf&adaptive=0&quality=high&bloom=0`, `…/?perf&adaptive=0&quality=low`. Jeweils dieselbe Fahrt auf Route C und dieselbe Sitzansicht mit der 10-s-Messung festhalten.
