# Next steps

Where each line of work left off. Work items live in GitHub issues; this file points at them.
Maintained by /checkpoint: one thread per branch, pruned when the branch merges.

## At a glance

- master — photo transcriber — next: one real transcription from the page, then go on down the notebook (Shankarabharanam)
- This run: #70 and #73 merged (close #59, #69); panyam/notation_demos#4 merged, so all 97 demo files load; filed #71 (a docs page per demo song). Dropped the #59 open questions, which #70 settled.
- Docs site and library (other session): #61, #62, #65, #67, #72, #88 merged (close #51, #50, #64, #47, #18). #88 splits `notations/core` and `notations/parser` and breaks `new Parser()` without gamakas; released as 2.0.0 on npm (`latest`). npm trusted publishing is set up for `publish-npm.yml`; 1.1.0 never reached npm. Leftovers: #66 (Safari/Firefox, DockView tabs via panyam/goapplib#254), #87 (yaml size), #48 (parked).

## Across threads

- The docs site deploys from `.github/workflows/docs.yml` after CI passes on master. Nobody pushes `gh-pages` any more.

## master

- **Last touched**: 2026-11-27 00:35 (Srirams-MBP:~/projects/notations/master)
- **Ticket**: none open. The page has pages as sources and an ordered list of transcriptions, each with its own ragam, talam and swaras per beat (#40). The CLI has `--page` and `--crop` (#52).
- **Why**: get the Valachi Vachi Navaragamalika notebook (two pages, nine ragas) transcribed from photos with little hand fixing.
- **Where it stopped**: the Kedaram rows read correctly from a crop with the CLI, octave dot included, for $0.19 at normal effort. Nobody has run a real transcription from the page yet; its browser checks used injected results. The CLI output from that run sits untracked in the repo root (`NavaRagamalikaVarnam.{sng,grid.json,report.txt}`); don't commit it.
- **Next action**: on the live page, add `~/projects/notations/NavaRagamalikaVarnam.pdf`, make a "Pallavi - Kedaram" entry (Adi, 4 per beat, both Kedaram rows), and transcribe. Then add entries down page 1: Shankarabharanam, Kalyani, Begada.
- **Open questions**: `~/projects/notation_demos/master` still has 90 uncommitted `\meta`-to-front-matter conversions and is 5 commits behind origin. Three of those files (`Thyagaraja/1/ManasuSvadhinamai.sng`, `MaanamuLeda.sng`, `SriGananathamBhajaymyaham.sng`) also changed upstream in panyam/notation_demos#4, so commit or stash before pulling.
