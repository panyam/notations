# Next steps

Where each line of work left off. Work items live in GitHub issues; this file points at them.
Maintained by /checkpoint: one thread per branch, pruned when the branch merges.

## At a glance

- master — photo transcriber, #42 — next: fix the octave-dot and ragam findings from the first real run
- This run: #53 merged (closes #30, #46, #49); the rest of #46 is #50, and the header drawer is #51

## Across threads

- The docs site deploys from `.github/workflows/docs.yml` after CI passes on master. Nobody pushes `gh-pages` any more.

## master

- **Last touched**: 2026-11-26 21:05 (Srirams-MBP:~/projects/notations/master)
- **Ticket**: #42, then #40 and #41. The photo transcriber shipped in #39.
- **Why**: get the Valachi Vachi Navaragamalika notebook (two pages, nine ragas) transcribed from photos with little hand fixing.
- **Where it stopped**: two real runs on the Kedaram rows, crop in `docs/components/photo/README.md` → Next steps. Every swara went in the right beat. The model missed the dot below the N in row 1's `SNSR`, and the front matter took the page's "KEDHARM" over `--ragams Kedaram`. Runs now report an estimated cost: $0.10 with a warm prompt cache, $0.13 cold.
- **Next action**: tune `docs/components/photo/prompt.ts` for octave dots, make a given ragam win in front matter, and drop the `console.log` at `src/parser.ts:506` (#42). Then run Shankarabharanam, the next raga down page 1.
- **Open questions**: #40 asks how transcription entries reach the editor. Option A appends as you go, and each entry keeps its result. Option B assembles the editor from the entries. The leaning is A. The user is still thinking about the layout. Also untested: whether "Careful reading" (effort `xhigh`) catches the missed octave dot, and what it adds in tokens. Run the Kedaram crop both ways to find out.
