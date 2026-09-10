# OpenAI Platform Watch：最新发布，怎样改变 PAW 的开发顺序？

## Continuity and benefits

用户纠正本报告必须从 OpenAI 最新发布判断 PAW 开发方向。前一份 story-v2 只改善了阅读形式，未充分呈现发布到建议的因果关系。本次交付是重新读取官方来源、固定 PAW 基线后的报告修订；不实施建议、不改变业务记录或计划。它让后续开发选择可以追溯到具体发布和当前功能；是否减少实际操作与维护成本，仍须各项试验回答。

## Report summary

重新核查 OpenAI 官方发布后，我建议：先验证 Astra 能否把一份职位材料从读取、对比做到保存；简历协作先考虑接入现有网页；邮件事件触发先做对照，再决定是否替换每天检查。每项都说明改与不改的短期和长期影响。本次读到的最新条目：ChatGPT/Codex 为 9 月 9 日，API 为 9 月 8 日，插件 UI 为 8 月 21 日。

## Report body

**这次值得调整的是 PAW 的开发顺序：先用 OpenAI 已经提供的能力完成一件求职工作，再根据实际缺口决定 PAW 要补什么。** 下面从近期发布讲起，逐项说明它们如何影响这个选择。

9 月 3 日，OpenAI 发布了 Astra，并增加了长任务中的工具等待与中途修改要求等能力。它带来的问题很实际：下次你让 AI 准备某个职位的材料，是否可以从读取职位描述、找到对应简历，一直做到有证据的要求对比和保存结果，而不是每一步都由你重新交代？PAW 已有保存职位材料与技能对比的地方，因此现在值得验证的是这条完整流程。我的建议是先在 ChatGPT 中试一份真实材料，再判断是否需要为网页另写一套分析程序。这是根据发布和 PAW 现状作出的推断，尚不是完成验证的结论。[9 月 API 发布记录](https://developers.openai.com/api/docs/changelog)

接着看简历。8 月 25 日发布的网页工具支持，给了我们一条比“重做整个编辑器”小得多的路：让 AI 和你使用同一张网页，调用网页主动提供的操作。你已经调好的区域顺序、预览和 Word/PDF 导出可以继续使用，AI 协作未必要求重建它们。不过，这条路线目前有客户端和模型限制，PAW 也还没有接入；它是值得试的小改动，不是已经能用的功能。[官方网页工具说明](https://learn.chatgpt.com/docs/webmcp)

同一天发布的 Gmail 事件触发，则改变了“什么时候处理邮件”的选择。假如一封面试邀请在上午检查结束后才到，按事件触发有机会更早处理。但 PAW 的任务要照顾两个邮箱、已有申请和重复邮件；“有一封新邮件触发任务”不等于这些规则都被完整执行。因此，我建议先比较事件触发与每日检查的结果，再考虑替换现有安排。[8 月 25 日发布记录](https://learn.chatgpt.com/docs/changelog)

**优先顺序是：职位材料的完整流程，其次是简历网页协作；邮件事件触发排在现有每日流程验收之后。** 原报告提出的“先做报告展示与决定入口”已经完成，这一项不再作为新的开发建议。单纯自动导入周报，也没有在本次官方发布中找到足够理由排到前面。

其他近期内容也检查过。9 月 8 日的缓存诊断适合排查重复请求为什么没省下输入成本，但本次没有 PAW 账单或缓存命中数据，不能据此承诺节省；先不为它建监控页面。当天的图像模型更新暂时不解决职位证据、简历版本或邮件覆盖问题。9 月 9 日的插件刷新与登录恢复改进有助于接入稳定性，却不能算作 PAW 定时写入已经修好的证据。[缓存诊断](https://developers.openai.com/api/docs/guides/prompt-caching/diagnostics)、[API 日志](https://developers.openai.com/api/docs/changelog)、[客户端日志](https://learn.chatgpt.com/docs/changelog)

本篇是对你指定的 [原 OpenAI Platform Watch 报告](https://workspace.ai-radar-lab.com/workspace/job-search/platform-watch/da950bd7-2254-422a-9ff8-9749d5ca92c3)重新查源后的修订。核查覆盖 8 月 21 日至 9 月 10 日的三份官方更新日志及相关当前文档；未发现比今天早些时候扫描所列最新日志日期更晚的条目。下面的变化是分析更具体、PAW 基线更新，不能冒充“刚刚又发布了新功能”。短长期影响均为预期，尚未实测。

## Choice 1

### 职位材料分析：先验证 ChatGPT 完整处理，再决定是否自建分析流程

这项选择来自 9 月 3 日的 Astra 发布。官方把它定位于结合推理、工具和文档处理完成复杂工作；新的异步工具能力允许模型在等待一个工具时继续做独立工作，中途修改要求也有专门支持。但如果直接使用 API，工具执行、待办任务和已发生操作仍需应用自己管理，不能理解为 OpenAI 接管了 PAW 的整个后台。[Astra 能力说明](https://developers.openai.com/api/docs/guides/latest-model)、[工具等待边界](https://developers.openai.com/api/docs/guides/async-tool-calling)、[中途修改要求的边界](https://developers.openai.com/api/docs/guides/steering)

PAW 已能保存职位链接、职位描述、简历文件关联和逐项技能对比；网页负责显示这些结果，GPT 负责获取材料和分析。另一个后台职位匹配功能仍未开启。现在有两个具体选择：继续把每次材料整理拆成临时对话；或者把“读同一份 JD 和简历、逐项比较、保存、重新读取确认”作为一套可重复的 ChatGPT 工作流程。另写网页分析后台是第三条路，但眼下还没有证据说明必须这样做。[PAW 职位材料流程](https://github.com/Andy-JunXiong/Personal-AI-Workspace/blob/9710bac89b4575fa7391a0a2aaa097c6753e304a/docs/architecture/APPLICATION_DOSSIER_WORKFLOW.md)

| 做法 | 短期：下一份职位材料 | 长期：继续准备申请与面试 |
| --- | --- | --- |
| 不改，继续临时分步处理 | 现有保存功能照用，无需新开发；仍要逐次确认用了哪份 JD、哪版简历，以及结果有没有保存 | 分析质量继续依赖每次交代是否完整；相似材料可能重复获取，资料缺项仍需逐份检查 |
| 先试一套完整的 ChatGPT 流程（建议） | 用一份已登记申请的材料走完读取、对比、保存、回读，记录人工纠正次数和缺失项；先付出整理步骤与验收的时间 | 若结果可靠，可重复使用同一流程，PAW 只需补实测缺口；仍受宿主权限和工具可用性影响，不能省掉材料来源与版本核对 |
| 现在另写网页分析后台 | 要新增模型调用、任务进度、失败恢复和结果写入，并重新测试；未必比已有对话入口更快交付 | 执行和监控更可控，但两条分析入口可能逐渐采用不同规则，也要持续承担 API 与维护成本 |

我建议先选第二种。与原报告笼统的“平台负责执行”相比，这次把判断落在 PAW 已经能承接的职位材料上。若同一流程经常因为宿主限制无法保存或恢复，而一段有限的后台程序能稳定解决该缺口，再考虑第三种。材料缺失时应明确留空，不能靠更强模型补造经历。

### Next step 1

选择一份已登记申请，使用实际 JD 和可确认版本的简历，试一次“读取—逐项对比—保存—回读”。验收看原文要求有无遗漏、个人经历有无杜撰、保存后能否重新打开，以及需要几次人工纠正。该试验尚未执行；不涉及投递、变更申请状态或开启后台自动匹配。

## Choice 2

### 简历编辑：先试现有网页上的 AI 协作，暂不重做整套会话内编辑器

8 月 25 日的发布介绍了网页工具，也叫 WebMCP：网站可以把已有操作提供给正在看同一网页的 AI。当前官方文档要求在 ChatGPT 桌面内置浏览器中使用，并列明 Sol/Terra 支持及其他限制；不能假定 Astra、普通 Chrome 或云端定时任务具有同样能力。这与把组件嵌入聊天的 MCP Apps 是两条不同路线。[网页工具与普通 MCP 的区别](https://learn.chatgpt.com/docs/webmcp)、[会话内组件说明](https://developers.openai.com/plugins/build/chatgpt-ui)

PAW 已有九区域简历编辑器，区域与条目能排序，预览和导出也已验收。原报告只强调先保留网页；现在应该进一步比较：是否给这个现成编辑器增加一小段 AI 协作入口，而不是为了 AI 交互重做整个页面。PAW 当前尚无这项网页工具接入。[现有简历编辑器](https://github.com/Andy-JunXiong/Personal-AI-Workspace/blob/9710bac89b4575fa7391a0a2aaa097c6753e304a/docs/architecture/RESUME_EDITOR.md)

| 做法 | 短期：下一次修改简历 | 长期：排版与 AI 协作 |
| --- | --- | --- |
| 不改，继续手动使用现有网页 | 排版、排序和导出继续可用；AI 的文字建议仍要由你搬到对应区域 | 维护最少，但对话建议与页面内容可能逐渐不一致，反复复制的步骤仍在 |
| 在现有网页试一个有限操作（建议） | 先只试“读取当前摘要、提出替换、确认后预览”，复用原校验和保存逻辑；需要增加入口并核对宿主支持 | 若确实少了复制与误操作，可以逐个扩展；不用立即养两套编辑器，但要维护网页工具兼容性，关闭页面后也不能靠它运行 |
| 把整个编辑器搬进聊天 | 要重新实现精细编辑、区域顺序、预览和文件获取；已有页面验收不能直接沿用 | 可能少切换页面，但布局和交互更依赖聊天宿主；原网页是否能退役，还要完整任务对照才能决定 |

我建议把第二种作为小试验，排在职位材料流程之后。如果“改摘要—看预览—取得导出文件”没有比手动方式减少步骤，或导出与保存不一致，就停在试验，不继续接更多操作。若目标客户端根本不支持网页工具，则保留现状；不能因官方发布就先启动整套迁移。

### Next step 2

先确认目标桌面客户端和受支持模型能使用网页工具，再在测试副本中验证摘要协作，比较手动与 AI 路径的操作次数、保存内容和导出结果。只在此项实际改善后扩展。此次报告没有接入 WebMCP、修改真实简历或迁移编辑器。

## Choice 3

### 招聘邮件检查：先对照事件触发，暂不替换每天 08:00 的检查

8 月 25 日，OpenAI 发布了 Gmail 等应用的事件触发：新邮件可以按发件人或主题筛选后启动任务。这给“早上检查之后才到的面试邀请”提供了更及时的处理机会。官方也说明，同一任务不能同时采用事件和时间计划，临近事件可能合并；账户资格、连接和双邮箱覆盖仍要实际确认。[事件触发规则](https://learn.chatgpt.com/docs/automations)

PAW 现在的每日流程检查两个邮箱，结合已有申请及邮件确认来避免误建记录，并保留处理回执。真实无人值守流程尚未完整验收。事件触发能改变启动时间，不能自动替我们证明“哪些邮件没收到触发、哪些申请已经结束、重试是否重复写入”。[当前每日流程](https://github.com/Andy-JunXiong/Personal-AI-Workspace/blob/9710bac89b4575fa7391a0a2aaa097c6753e304a/docs/architecture/CORE_JOB_WORKFLOW.md)

| 做法 | 短期：接下来几天的招聘邮件 | 长期：覆盖和恢复 |
| --- | --- | --- |
| 不改，只用现有每日检查 | 先把一个真实 08:00 运行核对完整，避免同时排查两套触发；检查后的新回复通常要等下一轮或手动查看 | 每日窗口与回执较容易复查，但时效性有限；依然要处理未完成运行后的补查 |
| 增加只读事件对照，暂不替换每日任务（建议） | 在账户支持的前提下，对相同邮件记录触发与处理时间，不产生第二条业务写入；多一次对照工作，但能看清是否漏掉另一个邮箱 | 若覆盖、去重和补查都通过，可考虑“事件及时处理＋独立定时补查”；代价是维护两种启动来源，而不只是少一个定时器 |
| 现在直接换成事件触发 | 可能更早看到新回复，但会在每日流程尚未验收时改变检查入口，难分辨遗漏来自筛选、连接还是保存 | 若没有独立补查，漏触发可能长期不被发现；若日后证实事件覆盖足够完整，才可能减少轮询负担 |

我的建议是先完成现有每日验收，再做第二种对照。原报告 W20260910-01 验证过的只是只读 Watch 调度，不是双邮箱招聘业务；这次把“何时换触发方式”的条件补具体。若无法同时覆盖两个邮箱，就不替换；若至少连续三天的对照没有解释不清的遗漏，并能处理一次重复触发和一次中断补查，再比较是否值得正式接入。

### Next step 3

先核对一次真实 08:00 运行。之后若决定试事件触发，先确认账户和两个邮箱的支持情况，再安排至少三天只读对照，并检查重复触发及中断补查。没有实际事件样本就继续留待验证。当前每日任务和每周 Watch 任务均未修改。

## Evidence appendix

- Run: manual fresh retrieval and source-led reanalysis, 2026-09-10, Australia/Sydney. Retrieval cutoff is the generated payload timestamp; no advance to the canonical reviewed-scan frontier is claimed before review.
- PAW/Skill ref: `9710bac89b4575fa7391a0a2aaa097c6753e304a`, resolved through the GitHub branch API. Pinned connector reads covered Skill, run reference, Watch ledger, CORE_JOB_WORKFLOW, README, APPLICATION_DOSSIER_WORKFLOW, RESUME_EDITOR and the Watch production ledger. Local `src/gmail/providers.ts` supplements the unchanged pinned code; no fresh production check is inferred from these documents.
- Previous reviewed source cutoff: `2026-09-10T05:50:14Z`. Both earlier reports remain historical snapshots; this revision references `da950bd7-2254-422a-9ff8-9749d5ca92c3` and corrects the emphasis of story-v2. No human disposition transfers between snapshots.
- Last confirmed production before this report: `watch-reading-20260910-r1`, `2026-09-10T11:33:58Z`, source `4ec6a4b0c9d7d75aecbfe34b6c92265d29bac777`. Evidence reused from the pinned release ledger, separately from this retrieval.
- Scan result: completed for declared source coverage. Directional judgment: NO_DRIFT, advisory; development priorities are narrowed to explicit experiments, with no REMOVE recommendation. The broad platform-first boundary already existed, so it is not represented as a newly discovered strategy.

| Source actually read | Coverage and use |
| --- | --- |
| ChatGPT/Codex changelog | All release summaries from August 21 through September 10; newest dated entry September 9. HTML retrieved directly and parsed to exclude PR-by-PR details. August 25 events/WebMCP support the comparisons; September CLI/iOS updates are screened, not assumed to prove PAW cloud parity. |
| API changelog | All entries August 21 through September 10; newest September 8. Astra and long-task controls September 3; error distinctions September 2; cache/images September 8. Pricing, regional processing, audio deprecations, Assistants shutdown and IPv6 screened without inventing a PAW migration requirement. |
| Plugin UI changelog | Latest entry August 21, stable OAuth callback/CIMD conditional on issuer support; older compatibility entries supply context only. No new September UI announcement claimed. |
| Current boundary pages | Scheduled tasks, Plugins, Memories, optional MCP UI, Workspace Agent trigger/status, Astra guidance, async tools, steering, cache diagnostics, and WebMCP all read. Agent status still cannot retrieve the response; memories are not demonstrated replacements for PAW versioned records. |
| Failed retrievals recovered | Web reader rejected markdown content types, so HTML pages and direct markdown retrieval were used. Guessed steering/cache/site-tools paths failed; actual canonical paths were followed and read. `/codex/webmcp` redirects to `/docs/webmcp`. No missing material source remains. |

Finding 1: `ASTRA-DOSSIER-FLOW`, CHANGED analysis of the previously screened September 3 release and the original platform-execution judgment; ADOPT / NOT_TESTED / PENDING. Reusable existing dossier workflow, not a claim that Astra is newly available after the prior cutoff.

Finding 2: `F1-UI-REVIEW`, CHANGED alternative to the same earlier UI finding; ADOPT / NOT_TESTED / PENDING. WebMCP page integration and MCP Apps embedded UI are distinct; the recommendation is a narrow test, not whole-editor migration.

Finding 3: `W20260910-01`, CHANGED scope of the earlier scheduling recommendation; ADOPT / UNRESOLVED / PENDING. Existing Watch success stays scoped to Watch. Gmail events were previously reported; current recommendation supplies a concrete PAW comparison and staged verification.

Technical follow-ups retained: W20260910-02 plugin distribution remains previously reported; W20260910-03 rate/overload error handling remains an unimplemented compatibility follow-up, with no retry added here. W20260910-04 source/production evidence gap has dated publication evidence. W20260910-05 report entry point is delivered; it is not proposed again. Current weekly task still pins its old procedure; this report does not claim to update that saved prompt.

### Publication and readback

- Saved through the authenticated PAW Web import form: [source-based revision](https://workspace.ai-radar-lab.com/workspace/job-search/platform-watch/ab0f5c52-40fc-440b-a960-df2936a5e77f).
- External ID: `openai-platform-watch:2026-09-10:official-refresh-v3`; generated/retrieval cutoff `2026-09-10T12:06:11.512Z` (22:06 Australia/Sydney).
- Independent read-only production query matched canonical SHA-256 `775f23a2e2abc5e77be7c85d14215cf8966f6ac604fa9188de457b8316530819` and body SHA-256 `9f7532643b2ba493f606c4ba24470edb2463df62cc0b6a09dd1671efb984ac1f`. All three findings are PENDING at version 1, with no decisions. Original two reports retained; three snapshots now exist.
- Schema and rendered-table checks passed. Desktop 1440px and phone 390px previews passed for the substantive report: three comparison tables, working choice anchors, no raw Markdown or horizontal overflow. A final shorter opening/summary clarification was schema/render-checked and confirmed in authenticated live readback. The live page shows the revised title, official-source links and all three choice navigation labels.
- No runtime code, deployment, mail scan, model setting or schedule changed. Current service is healthy; resume version 5 and ten candidates remain. Temporary operator-only SSH access used for readback was restored. Existing application tests were not rerun for this content-only revision.
