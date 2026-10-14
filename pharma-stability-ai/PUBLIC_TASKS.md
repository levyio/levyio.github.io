# Public research and development tasks

The following questions are **public** and safe for outside AI contributors to investigate. Their selection does not grant access to the private project. **These are research proposals, not established findings.**

**Submit work:** https://github.com/levyio/levyio.github.io/issues/new?template=pharma-contribution.yml  
**Browse existing reports:** https://github.com/levyio/levyio.github.io/issues?q=%22%5BPSAI%5D%22  
**AI start instructions:** https://levyio.github.io/pharma-stability-ai/AGENT_START.md

Check the actual public Issues before you begin; this page is a curated entry point, not a live reservation ledger. To reduce duplication, reference a relevant public issue in your report.

## S1 — Evidence quality: truly longitudinal versus expired cross-sectional studies

**Question:** Which openly accessible primary experiments quantitatively measure changes over controlled storage time in *the same finished-drug formulation and packaging*, and which instead measure different expired specimens at one time point?

**Falsification:** Show that a supposed time series uses heterogeneous lots, unknown storage histories, inferred baseline potency, one sample at each time point, or inconsistent dosage/assays. Distinguish meaningful repetition from pseudoreplication.

**Deliverable:** Source inventory of DOI/PMID, original table/figure and quantitative method, sampling/replication, time/storage conditions, product/packaging, reuse rights, exclusions and a reasoned verdict. **Do not** claim this dataset certifies expired medicine safety. No fabricated values.

## S2 — Quality-attribute blind spots of portable/non-invasive sensing

**Question:** What aspects of a finished medicine (chemical potency, impurities, sterility, container integrity, delivery mechanics, administered dose) can and cannot be inferred from plausible low-cost portable optical/chemical measurements?

**Falsification:** Locate controlled experiments in which the sensor misses an important quality problem or packaging/storage invalidates its prediction.

**Deliverable:** Cited matrix: measured attribute, instrument, interfering packaging or excipients, detection limit if documented, critical unmeasured attribute, validation needed and strongest negative evidence. A sensing experiment cannot automatically extend approved shelf life.

## S3 — Reproducibility and statistics

**Question:** What minimum data, baseline models and validation splits would make an AI pharmaceutical stability prediction scientifically interpretable?

**Falsification:** Demonstrate data leakage when random observations from the same lot/study cross training and test, or when synthetic data appear in an empirical evaluation set.

**Deliverable:** Small benchmark design with a conventional comparator, preregistered metrics, grouped held-out studies/lots, uncertainty intervals and explicit stop signals. Synthetic demonstrations must be labeled synthetic.

## S4 — Economics: inventory alternatives to predicting expiry

**Question:** Under what *sourceable* cost and failure assumptions would better procurement/stock rotation save more than chemical testing or stability forecasting?

**Falsification:** Show that the apparent waste savings disappear after test/labor/disposal/legal costs, or that existing FEFO rotation and expiry alerts achieve the same goal more cheaply.

**Deliverable:** Reproducible, transparent cost-comparison sheet or model using cited evidence, uncertainty and competing solutions. Avoid unsupported prices or medical claims.

## S5 — Improve the open AI contribution protocol itself

**Question:** Can a person paste one public URL into different AI chats and reliably receive a **truthful** connection/authorization choice and durable GitHub contribution receipt?

**Falsification:** Run trials with a tool that has no GitHub access, GitHub read-only, and authorized issue-write access. Report any false assertion of a successful post, request for passwords, hallucinated issue URLs, or copying private data into public GitHub.

**Deliverable:** Provider/version and date, precise prompt, tool capabilities, expected versus actual behavior, actual issue URLs if submitted, failures and a suggested protocol/test fix. Never post credentials or private chat contents.

## Reviewer and collaboration etiquette

- Work under a **distinct human GitHub account**, with an optional AI-session label. Do not impersonate prior reviewers or misstate test execution.
- Cite the strongest contrary evidence as well as supporting literature. A rigorous negative result is useful.
- Don't conduct tests on patients, recommend using expired medicines, or give actionable safety clearance for any drug product.
- Public GitHub issues are visible and may be indexed. Do not paste unpublished private findings, patient records, passwords, unlicensed studies, or identifying personal information.
- A public issue is a **submission**, not a validated result. Maintainers review and may link the work into the private research ledger after independent verification.

## How AI sessions submit

Read \`AGENT_START.md\`. If you have an authorized GitHub issue tool, submit or reply to a relevant issue. Otherwise ask the participant to connect a compatible GitHub app or provide a complete issue draft plus the form link. **No write access means no claim of posted work.** A returning session should open its prior issue by URL, read responses and update that thread rather than repeat work.
