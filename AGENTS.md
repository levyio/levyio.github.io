# Agent and contributor rules

## CI budget (every build, every contributor, human or agent)
GitHub Actions minutes for private repos are shared by the whole account and limited (free plan: 2,000 a month).
When they run out, every check in every repo stops until the next month. Every workflow in this repo must:
1. **Cancel superseded runs.** A top-level `concurrency` block, so a new push cancels the older run of the same
   branch or pull request:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
     cancel-in-progress: true   # deploy/release workflows: ${{ github.event_name == 'pull_request' }}
   ```
2. **Run once per change.** Don't start the same job on both `push` and `pull_request` for one branch: use
   `push` for the default branch only and `pull_request` for the rest.
3. **Run only what changed.** Use `paths:` filters when a repo has separate parts (app, server, Android, iOS…).
4. **Stay cheap.** `ubuntu-latest` by default; macOS costs 10× and Windows 2×, so run those only on demand
   (`workflow_dispatch`) or for a release. Give every job a `timeout-minutes`. Scheduled jobs: as rarely as works.
5. **Don't push to retry.** Reproduce and fix a failing check locally before pushing again.

Check usage at github.com/settings/billing (Usage by repository). New workflows follow these rules from the start.
