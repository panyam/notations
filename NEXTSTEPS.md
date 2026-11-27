# Next steps

Where each line of work left off. Work items live in GitHub issues; this file points at them.
Maintained by /checkpoint: one thread per branch, pruned when the branch merges.

## At a glance

- master — photo transcriber, #59 — next: one real transcription from the page, then go on down the notebook (Shankarabharanam)
- This run: #60 merged (closes #52, #40); panyam/notation_demos#2 merged; the v3 demo review is panyam/notation_demos#3
- Docs site (other session): #61, #62, #65 merged (close #51, #50): drawer, Pagefind search, lazy notation code, WCAG AA colours, cspell in CI. s3gen v0.1.8 copies `static/`. Leftovers are in #64.

## Across threads

- The docs site deploys from `.github/workflows/docs.yml` after CI passes on master. Nobody pushes `gh-pages` any more.

## master

- **Last touched**: 2026-11-26 22:00 (Srirams-MBP:~/projects/notations/master)
- **Ticket**: #59, the follow-ups from #60. The page now has pages as sources and an ordered list of transcriptions, each with its own ragam, talam and swaras per beat (#40). The CLI has `--page` and `--crop` (#52).
- **Why**: get the Valachi Vachi Navaragamalika notebook (two pages, nine ragas) transcribed from photos with little hand fixing.
- **Where it stopped**: the Kedaram rows read correctly from a crop, octave dot included. That cost $0.19 at normal effort; careful cost $0.46 and gained nothing. Nobody has run a real transcription from the new page yet; the browser checks used injected results.
- **Next action**: on the live page, add `~/projects/notations/NavaRagamalikaVarnam.pdf`, make a "Pallavi - Kedaram" entry (Adi, 4 per beat, both Kedaram rows), and transcribe. Then add entries down page 1: Shankarabharanam, Kalyani, Begada.
- **Open questions**: #59 asks whether `\cycle("6 4 4")` should parse or error, and what `<<"..."` means in three Thyagaraja demo files. The `\meta` conversions in `~/projects/notation_demos/master` (90 files) are still uncommitted.
