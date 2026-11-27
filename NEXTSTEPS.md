# Next steps

Where each line of work left off. Work items live in GitHub issues; this file points at them.
Maintained by /checkpoint: one thread per branch, pruned when the branch merges.

## At a glance

- master — #86 photo transcriber — next: run #86's exercise, starting with the Kedaram entry on the live page
- #48 is at 5/17. `pnpm run exercise:48` @ 32708a2 breaks at step 3, because there's no playback (#75), so #75 is the one to promote. #74 (PNG/SVG export) is in progress in another session.
- This run: #99 merged, closing #92 (the exercise is one command) and #87 (front matter without yaml). The merged branches deps/90, fix/94 and feat/92-87 still exist on the remote, with no open threads.

## Across threads

- The docs site deploys from `.github/workflows/docs.yml` after CI passes on master. Nobody pushes `gh-pages` any more.
- Next release: since #99, nested YAML, block lists and multi-line strings in front matter are a parse error. Decide between 3.0.0 and 2.x with a release note. No ticket; nothing uses nested front matter.

## master

- **Last touched**: 2026-11-27 16:30 (Srirams-MBP:~/projects/notations/docs)
- **Ticket**: #86 (mission). The page has pages as sources and an ordered list of transcriptions, each with its own ragam, talam and swaras per beat (#40). The CLI has `--page` and `--crop` (#52).
- **Why**: get the Valachi Vachi Navaragamalika notebook (two pages, nine ragas) transcribed from photos with little hand fixing.
- **Where it stopped**: the Kedaram rows read correctly from a crop with the CLI, octave dot included, for $0.19 at normal effort. Nobody has run a real transcription from the page yet; its browser checks used injected results. The CLI output from that run sits untracked in the repo root (`NavaRagamalikaVarnam.{sng,grid.json,report.txt}`); don't commit it.
- **Next action**: on the live page, add `~/projects/notations/NavaRagamalikaVarnam.pdf`, make a "Pallavi - Kedaram" entry (Adi, 4 per beat, both Kedaram rows), and transcribe. Then add entries down page 1: Shankarabharanam, Kalyani, Begada. Log the result on #86.
