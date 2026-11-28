# Next steps

Where each line of work left off. Work items live in GitHub issues; this file points at them.
Maintained by /checkpoint: one thread per branch, pruned when the branch merges.

## At a glance

- master — #86 photo transcriber — next: run #86's exercise, starting with the Kedaram entry on the live page
- #48 is at 6/17. `pnpm run exercise:48` @ 18870a4 passes steps 1 and 2 (print, SVG, PNG) and breaks at step 3, playback (#75, P3). Next is a choice: #71 (the queue's next ready, P2), a design pass to promote #75, or #77 (save and share, which unblocks step 5).
- This run: #95, #98 and #100 merged (#74 and #97 closed); their entries are in CHANGELOG `[Unreleased]`. Dropped last run's note about the merged deps/90, fix/94 and feat/92-87 branches, which have no threads.

## Across threads

- The docs site deploys from `.github/workflows/docs.yml` after CI passes on master. Nobody pushes `gh-pages` any more.
- Next release: `[Unreleased]` holds #87, #90, #94, #74 and #97. Since #87, nested YAML, block lists and multi-line strings in front matter are a parse error, so decide between 3.0.0 and 2.1.0 with a release note. The user is adding more features before cutting it.
- panyam/notation links notations master, not npm, so it picks up a merge when `web/node_modules/notations` is rebuilt (its CLAUDE.md says how).

## master

- **Last touched**: 2026-11-27 16:30 (Srirams-MBP:~/projects/notations/docs)
- **Ticket**: #86 (mission). The page has pages as sources and an ordered list of transcriptions, each with its own ragam, talam and swaras per beat (#40). The CLI has `--page` and `--crop` (#52).
- **Why**: get the Valachi Vachi Navaragamalika notebook (two pages, nine ragas) transcribed from photos with little hand fixing.
- **Where it stopped**: the Kedaram rows read correctly from a crop with the CLI, octave dot included, for $0.19 at normal effort. Nobody has run a real transcription from the page yet; its browser checks used injected results. The CLI output from that run sits untracked in the repo root (`NavaRagamalikaVarnam.{sng,grid.json,report.txt}`); don't commit it.
- **Next action**: on the live page, add `~/projects/notations/NavaRagamalikaVarnam.pdf`, make a "Pallavi - Kedaram" entry (Adi, 4 per beat, both Kedaram rows), and transcribe. Then add entries down page 1: Shankarabharanam, Kalyani, Begada. Log the result on #86.
