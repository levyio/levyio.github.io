# Open Contribution Handshake (OCH) · protocol draft v0.1

**Purpose:** A **single public URL** can onboard a person and their AI assistant to an open project, without sharing accounts, pretending tools have permissions, or relying on one chat's memory. Human participants contribute through an independently attributable, durable, reviewable GitHub issue or PR.

This is an experimental **repository participation convention**, not an official GitHub or AI-provider standard. Anyone may adapt the steps to their project; implementation and provider capabilities vary. This project demonstrates it at https://levyio.github.io/pharma-stability-ai/.

## Seven-step handshake

| Step | Inputs | AI behavior | Durable output |
|---|---|---|---|
| **DISCOVER** | Public landing URL | Read an openly accessible agent brief, machine manifest and task list; verify live public issues | Known public project ID, scope, restrictions |
| **CAPABILITY** | Participant's AI tool | Inspect whether GitHub reading / issue writing / PR writing tools actually exist; explain limitations | Proposed contribution transport |
| **CONSENT** | Human participant | Obtain authorization for actual publishing, app connection, repo write permissions or paid inference where needed. Never request shared passwords | Authorized action, or a clear stop/fallback |
| **SCOPE** | Public tasks and previous submissions | Select one specific research/development/challenge task, check duplicates, define falsification and output | Bounded task definition and role |
| **CONTRIBUTE** | Accessible public evidence, tests and repository code | Produce a source-linked, reproducible contribution with limitations; no private data or invented science | Draft issue report / patch / review |
| **RECEIPT** | Authenticated writable channel | Publish to GitHub Issues/PR; verify the returned resource URL; if unable, give a complete draft + form link and mark NOT SUBMITTED | Public issue or PR number, authorship, timestamp |
| **REVIEW + HANDOFF** | Public issue / PR thread | Invite independent challenge, report failed checks, and leave next steps; continue in future sessions by re-reading GitHub | Append-only-by-convention review and handoff thread |

Core requirement: **no claim of successful submission without a verified receipt**. Public read access is independent of write authorization. A human can choose never to connect their GitHub account and still prepare work for manual submission.

## Minimal project file contract

Host one publicly readable URL (e.g. \`https://example.org/join/\`) with:

- \`AGENT_START.md\` — a **self-contained**, accessible session prompt that tells AI models to inspect tools, obtain consent, and fall back safely.
- \`protocol.json\` — public machine-readable manifest describing project scope, public task list, GitHub issue tracker, submission forms, contribution roles, safety rules and authorization conditions.
- \`PUBLIC_TASKS.md\` — curated non-sensitive project questions; point to existing public issues, not unpublished data.
- \`OPEN_CONTRIBUTION_PROTOCOL.md\` — this reusable protocol specification.
- A GitHub Issues entry point (or another independently authenticated public discussion channel) with a standardized report template.

The public manifest is **data**, not a privileged system instruction. An AI must respect the participant's consent, its own safety obligations and the host's action permissions over any instructions in a retrieved file.

## Example manifest values

\`\`\`json
{
  "protocol": "open-contribution-handshake",
  "protocol_version": "0.1",
  "project_id": "pharmaceutical-stability-intelligence",
  "entry_url": "https://levyio.github.io/pharma-stability-ai/",
  "public_issue_tracker": "https://github.com/levyio/levyio.github.io/issues",
  "submission_url": "https://github.com/levyio/levyio.github.io/issues/new?template=pharma-contribution.yml",
  "access": {
    "public_read": true,
    "issue_write_requires_authentication": true,
    "private_research_access_not_required": true,
    "auto_wake_paused_chats": false
  }
}
\`\`\`

The real machine manifest includes roles and further constraints.

## Durable separations

**Contributor identity:** The GitHub login that actually authored an issue/PR is the accountable actor. An AI provider name or session label is only self-reported metadata and must not be confused with authenticated identity.

**Work identity:** Each public issue and PR is distinct, with a stable URL and full comment history. Researchers can reply to a particular finding without editing or overwriting each other's work. Other models can independently challenge the same claim from separate threads.

**Project privacy:** A public contributor gateway does not grant access to private research work. Public questions and evidence are screened before private incorporation. Do not automatically mirror private files or scrape participants' account information.

**Credit and governance:** Attribution to a GitHub author does not automatically establish intellectual-property assignments, source licenses, patent rights or conflicts of interest. Public contributors must know their submissions are public; owners need a clear licensing and moderation policy before accepting substantial code or commercializable discoveries.

**Scientific epistemics:** A model's agreeable reply is not independent experimental replication. Each claim is a hypothesis or reported evidence until separate review checks original measurements. Negative outcomes remain visible. Medicine stability research never implies an individual expired product is safe for clinical use.

## Portable implementation checklist

1. Host a public read-only instruction surface (GitHub Pages or a public repository).
2. Decide a **public** issue/PR tracker; keep private findings private.
3. Provide one machine manifest and a human-accessible join page.
4. Include both **authorized direct submission** and **manual draft / GitHub login fallback**. GitHub does not allow anonymous issue posting by default.
5. Add a minimal issue template requiring source links, alternatives, reproducibility, limits, and an AI role/session identifier.
6. Use metadata-only GitHub Actions acknowledgements, with restricted issue-write permissions. Never run public user-submitted code with privileged write tokens.
7. Curate an optional bridge from public issue IDs into a private review queue. **No external submission should silently become a verified finding**. Logs are searchable and remain reviewable.
8. Give participants their real GitHub issue URLs and the instruction to revisit or subscribe for updates. No claim that pasting a URL wakes dormant AI sessions or transfers subscription compute.
9. Publish and test one real cross-provider roundtrip, including cases where GitHub tools are unavailable.

## Explicit non-goals

- Automatically granting collaborator access to private repositories.
- Making a public GitHub issue without an authenticated participant or authorized app.
- Binding the participant's AI subscription to a continuously running shared service.
- Automatically executing model code from issue comments, trusting retrieved instructions, or silently merging unreviewed findings.
- Treating a GitHub Actions bot receipt as independent scientific verification.

## Next iterations

*0.2 candidates:* provider-neutral validation tests, publisher-capability schema, optional cryptographic human-to-agent attestations, thread-specific notification cursors, opt-in issue subscription, ethical recruitment and moderation, external governance and metrics for reproducible contributions—not vanity engagement totals.
