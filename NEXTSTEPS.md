# Next steps

Where each line of work left off. Work items live in GitHub issues; this file points at them.
Maintained by /checkpoint: one thread per branch, pruned when the branch merges.

## At a glance

- master — #86 photo transcriber — next: run #86's exercise, starting with the Kedaram entry on the live page
- #48 is at 3/17. Its exercise @ 75c0ae5 breaks at step 3, because there's no playback (#75). Next ready: #74 (PNG/SVG export; print merged in #95), then #92.
- This run: #93 (#90) and #96 (#94) merged, and panyam/notation_demos#5 moved the demo songs to front matter. Dependabot alert 127 was dismissed. Dropped the notation_demos open question.

## Across threads

- The docs site deploys from `.github/workflows/docs.yml` after CI passes on master. Nobody pushes `gh-pages` any more.

## master

- **Last touched**: 2026-11-27 15:30 (Srirams-MBP:~/projects/notations/docs)
- **Ticket**: #86 (mission). The page has pages as sources and an ordered list of transcriptions, each with its own ragam, talam and swaras per beat (#40). The CLI has `--page` and `--crop` (#52).
- **Why**: get the Valachi Vachi Navaragamalika notebook (two pages, nine ragas) transcribed from photos with little hand fixing.
- **Where it stopped**: the Kedaram rows read correctly from a crop with the CLI, octave dot included, for $0.19 at normal effort. Nobody has run a real transcription from the page yet; its browser checks used injected results. The CLI output from that run sits untracked in the repo root (`NavaRagamalikaVarnam.{sng,grid.json,report.txt}`); don't commit it.
- **Next action**: on the live page, add `~/projects/notations/NavaRagamalikaVarnam.pdf`, make a "Pallavi - Kedaram" entry (Adi, 4 per beat, both Kedaram rows), and transcribe. Then add entries down page 1: Shankarabharanam, Kalyani, Begada. Log the result on #86.
