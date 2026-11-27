# Next steps

Where each line of work left off. Work items live in GitHub issues; this file points at them.
Maintained by /checkpoint: one thread per branch, pruned when the branch merges.

## At a glance

- master — photo transcriber, #52 — next: run the Kedaram rows as a crop to see whether the faint octave dot gets read
- This run: #54 and #55 merged (close #42 and #41); the transcriptions-list part of #41 moved to #40; leftovers filed as #52

## Across threads

- The docs site deploys from `.github/workflows/docs.yml` after CI passes on master. Nobody pushes `gh-pages` any more.

## master

- **Last touched**: 2026-11-26 20:50 (Srirams-MBP:~/projects/notations/docs)
- **Ticket**: #52, then #40. The photo transcriber shipped in #39. #54 fixed ragam precedence, and #55 keeps uploads and the editor in IndexedDB.
- **Why**: get the Valachi Vachi Navaragamalika notebook (two pages, nine ragas) transcribed from photos with little hand fixing.
- **Where it stopped**: a whole-page run with the new octave-dot guidance still read row 1's `SNSR` without the dot under the N. At 500 dpi the dot is a few faint pixels, and the 2400 px downscale shrinks it to one or two. The front matter now takes `--ragams` over the page heading.
- **Next action**: crop the two Kedaram rows from `~/projects/notations/NavaRagamalikaVarnam.pdf` and run them with `--talam "|4|2|2|" --npb 4 --case swarasthana --ragams Kedaram`, once at the default effort and once with `--careful` (effort xhigh) (#52). Then go on to Shankarabharanam.
- **Open questions**: #40 asks how transcription entries reach the editor. Option A appends as you go, and each entry keeps its result. Option B assembles the editor from the entries. The leaning is A. Once #40 lands, its list goes in `docs/components/photo/photoStore.ts`, and the stored `photos` key needs a migration.
