# Meeting-batch GitHub issues (long-running agent scope)

These markdown files are the **source bodies** for fat issues meant for **~2+ hours** of agent work each (wall time **not guaranteed** — scope is what creates depth).

## Active meeting batches

| Module | GitHub issue | Body file |
|--------|----------------|-----------|
| Control Tower | [#9](https://github.com/lasealco/po-management/issues/9) | [`_gh-issue-body-tower-meeting.md`](./_gh-issue-body-tower-meeting.md) |
| CRM | [#10](https://github.com/lasealco/po-management/issues/10) | [`_gh-issue-body-crm-meeting.md`](./_gh-issue-body-crm-meeting.md) |
| WMS | [#11](https://github.com/lasealco/po-management/issues/11) | [`_gh-issue-body-wms-meeting.md`](./_gh-issue-body-wms-meeting.md) |
| Tariff | [#12](https://github.com/lasealco/po-management/issues/12) | [`_gh-issue-body-tariff-meeting.md`](./_gh-issue-body-tariff-meeting.md) |
| SRM | [#13](https://github.com/lasealco/po-management/issues/13) | [`_gh-issue-body-srm-meeting.md`](./_gh-issue-body-srm-meeting.md) |
| Sales orders | [#14](https://github.com/lasealco/po-management/issues/14) | [`_gh-issue-body-sales-orders-meeting.md`](./_gh-issue-body-sales-orders-meeting.md) |
| API hub (ingestion P0) | [#16](https://github.com/lasealco/po-management/issues/16) | [`_gh-issue-body-apihub-p0.md`](./_gh-issue-body-apihub-p0.md) |

**Parallel rule:** start **at most one agent per issue**, each on **different module paths**. **Tariff** ([#12](https://github.com/lasealco/po-management/issues/12)) and **sales orders** ([#14](https://github.com/lasealco/po-management/issues/14)) are different modules — OK in parallel; do **not** mix tariff paths into #14.

## Copy-paste agent starter (per window)

```text
Repo: lasealco/po-management (this workspace). Implement GitHub issue #___ only.
Read the full issue body + every comment. Complete every unchecked checkbox in order.
Branch from main; one PR; do not merge to main.
Do not run db:seed or db:migrate unless the issue explicitly says so — if blocked, stop and ask Alex.
If a step is larger than expected, finish the current checkbox, commit, push, then continue on the same branch in the same chat with "continue with the next checkbox".
```

Replace `#___` with **9**–**14** or **16** (see table; **12** = tariff, **14** = sales orders, **16** = API hub P0).
