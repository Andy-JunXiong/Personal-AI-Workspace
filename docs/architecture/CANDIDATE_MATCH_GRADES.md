# 候选职位 JD 匹配评级：保存与读取契约

状态：2026-09-11，存储、接口和 Jobs 评级展示已本地实现并验证；部署和真实使用验收待完成。上游为
[R3 评级待办](../strategy/PRODUCT_SOLUTION_ROADMAP.md#candidate-match-grades)。
本文限定交互式 ChatGPT 评估结果，不启用后台外部模型匹配。

## Continuity and benefits

- **上游需求：** 用户需要在职位列表比较 A+ 至 B− 的匹配评级，并保留岗位要求、
  经历依据、资料版本和纠正记录。[现有资料库](JOB_LIBRARY_WORKFLOW.md)已有候选、
  JD 和来源；数值匹配结果目前覆盖保存，不能承担完整的评级历史。
- **本次交付：** 新增 migration 019、独立评估服务、MCP 保存接口、准备资料读取、
  历史分页与共用摘要，后续已接入 Jobs 列表/详情、来源快照及历史版本浏览。
  没有生产变更；候选决定、申请状态、已投递材料及定时任务不在本包范围内。
- **下游：** 完成发布恢复验证，再用真实完整 JD 完成交互式
  保存和跨会话读取验收。R2 完整申请资料验收独立保留。
- **近期价值：** 合成测试已验证来源快照可跨客户端读回、缺失资料不能强行评级、
  更新资料会标记过期，以及保存不会改变候选/申请/任务；
  减少重复评估和查找聊天的收益仍需实现后实测。
- **长期价值：** 建立可追溯的投递前评估历史，供岗位选择与简历准备复用；
  来源引用证明可追溯性，不能独自证明模型判断正确或预测录用结果。

平台职责沿用[路线图的所有权判断](../strategy/PRODUCT_SOLUTION_ROADMAP.md#3-保留简化及不建设的内容)：
ChatGPT 完成推理，PAW 保存领域对象、来源和经验证的命令。本文未声称当前平台
已经提供新的接口，也不实现通用 Agent runtime 或完整的
[intelligence ledger 提案](JOB_SEARCH_INTELLIGENCE_ARCHITECTURE_v1.md)。

## 已检查的实现与复用边界

| 现有入口 | 可复用部分 | 本次设计需要补齐 |
| --- | --- | --- |
| `src/application/job-library-service.ts` | 候选归属检查、JD、去重后的有效来源及版本 | JD 读取指纹、明确输入清单；现有 `saveFit` 覆盖保存且未绑定基础简历版本 |
| `src/application/resume-service.ts` | 基础简历正文、来源 URL、`recordVersion` | 评估绑定读取时的版本和正文快照 |
| `src/domain/job-fit.ts` | 岗位与经历原文引用的校验思路 | 独立字母评级契约，避免把数值分数或覆盖率换算成评级 |
| `src/mcp/create-server.ts` | `workspace_get_job_candidate` 与候选列表读取 | 完整准备输入、评级摘要/历史及专用评估保存命令 |
| `src/application/candidate-service.ts` | 身份、版本、显式用户依据、幂等模式 | 独立评估命令；不借用候选登记或决定命令写评估 |
| `src/web/views.ts`、`src/web/job-library-views.ts` | Jobs 列表、候选详情与 JD 展示 | 共用服务端评级状态，展示理由、证据及历史 |

## 1. 读取评估输入

扩展现有 `workspace_get_job_candidate`，保留现有候选字段。默认增加轻量
`matchAssessment` 摘要；调用方显式请求 `includeAssessmentContext` 时才附加正文。
相关经历以明确的 `sourceIds` 选择，不能把有限选择描述为整个资料库都已检查。
未选择来源时返回有上限的来源目录和遗漏提示，再按 ID 读取；不静默截断正文。

准备上下文在同一数据库读取事务内组成：

- 候选 ID、`recordVersion`、公司/岗位、原职位 URL、读取时间。
- 已保存 JD 全文、来源 URL、内容指纹。指纹由服务器对文本与来源 URL 计算；
  `updated_at` 可以展示，但不单独充当可靠版本。
- 明确的基础简历 `recordVersion`、正文、来源 URL、内容指纹。第一版统一使用
  基础简历；不把某份职位工作稿自动当作基础版或已投递版。
- 所选有效资料的 ID、版本、标题、URL、审阅状态、正文与指纹。
  沿用当前 Word 去重/排除选择；显式纠正来源必须可见，不让历史材料覆盖纠正。
- 有效资料库目录指纹，以便新增纠正或来源选择变化时提示重评；
  保存所选来源清单，区别“用于论证的证据”与“其余可用资料”。
- `missingMaterials`、正文大小及范围说明。无 JD、无基础简历或选择来源不可用时，
  仍能返回候选，但不能返回虚假的完整评估输入。

正文总量设置明确上限，沿用现有资料库 600,000 字符上限作为最大边界。
超限必须报告并要求收窄选择；实现阶段验证实际 MCP 响应大小，不以字符数
替代平台可读性验收。来源内容只作为证据，不能提供执行指令或权限。

## 2. 保存评估

领域命令 `workspace_record_candidate_match_assessment` 已加入本地服务器。
生产仍为既有 30 个工具，本地为 31 个；部署及连接器刷新尚未进行。命令接收：

| 字段 | 约束 |
| --- | --- |
| `candidateId`、`expectedCandidateVersion` | 精确候选、当前身份下归属及乐观版本检查 |
| `expectedAssessmentVersion` | 首次为 0；新评估或纠正必须针对最新版本 |
| `inputManifest` | 回传服务器提供的 JD、基础简历、来源及目录指纹/版本 |
| `rubricVersion` | 固定 `candidate-match-grades-v1`；口径沿用路线图，不重复定义分数换算 |
| `grade`、`reason` | A+、A、A−、B+、B、B− 之一及一句主要理由；资料不足时 `grade=null` |
| `requirements` | 岗位要求、JD 原文、必要/优先分类、MATCH/PARTIAL/UNKNOWN、证据引用和单独的推断说明 |
| `strengths`、`gaps`、`questions` | 分别引用相关要求项；未找到证据不能写成确定缺乏能力 |
| `completeness` | ChatGPT 是否审阅完整 JD 的声明、资料缺失与限制；服务器不凭文本长度认证 JD 完整 |
| `supersedesAssessmentId`、`correction` | 后继关系；用户纠正需保留其明确陈述或来源依据，不把模型重评伪装成用户纠正 |
| `provenance` | 评估方为 ChatGPT、实际可知的会话/报告引用和生成时间；未知模型名称不编造 |
| `userConfirmed`、`authorityReference`、`idempotencyKey` | 沿用当前身份映射和显式用户指令引用；评级保存权限不扩展为候选决定或申请变更 |

评级、完整性、要求、结论和评估方来源字段位于 `report` 对象内；`correction` 与
后继 ID 位于命令顶层。精确字段和上限由
[`recordCandidateAssessmentSchema`](../../src/domain/candidate-match-assessment.ts) 定义。
`inputManifest.selectedSourceIds` 同时保留不可用的选定来源 ID，避免回传时丢失
缺失项；`sources` 保存当前可读来源的版本和指纹。已确认纠正自动加入选择。

服务器在一个事务中重新读取当前输入并校验：

1. 验证身份与候选归属，再检查同作用域、同操作的幂等键。相同请求重放返回
   原评估，标注重放；相同键不同请求报冲突，不创建第二条历史。
2. 对新请求验证候选版本、最新评估版本及整个输入清单。任一变化报并发冲突，
   零写入，调用方重新读取后决定是否重评。
3. JD 引文必须来自保存的 JD；简历和经历引用必须指向清单内的精确版本和原文。
   引文无依据、来源被排除、重复要求项、超限或未知契约字段拒绝保存。
4. 没有基础简历、没有完整 JD 的评估声明，或存在评估方声明的关键材料缺失时，
   只允许无评级结果并列出缺失项。单项 UNKNOWN 不自动降低为 B−；
   具体评级仍由 ChatGPT 结合完整输入给出并说明限制。
5. 插入不可变评估及对应幂等记录。服务器提供保存时间、递增评估版本、
   当前操作者和身份通道；不能信任输入自称的操作者。

不得将结果塞入 `fit_reason`、覆盖旧 `job_candidate_fit` 或创建虚假申请。
新表保存评估与当时的 JD、基础简历和所选经历快照，保留 URL、版本和审阅状态。
这样原可变资料更新后，历史证据仍可回读。私有正文只在 Workspace 数据库内保存，
不进入仓库、日志或公开验收附件。迁移为 `019_candidate_match_assessments.sql`，
新增一张表和禁止更新/删除历史的触发器；幂等记录与评估在同一事务内写入。

## 3. 读取状态、历史与显示

列表和详情通过同一查询服务生成状态；前端不另算评级或失效结论。

| 当前输入及结果 | 当前展示 | 历史 |
| --- | --- | --- |
| 没有可用 JD | JD 待补充 | 旧结果如有则保留，注明当前 JD 不可用 |
| 无结果，或结果明确缺少关键材料 | 待评估，列出缺失项 | 可查看此前无评级结果 |
| 最近结果输入与当前完全匹配 | 评级、一句理由、评估时间；或无评级原因 | 可按版本查看 |
| JD/基础简历/已用资料/有效目录指纹变化 | 待重新评估，说明变化原因 | 旧评级仅以历史结果展示，不冒充当前有效评级 |

候选的保存/忽略决定不会单独使评估失效；岗位身份或来源被更正则提示重新评估。
实现需将实际用于判断的候选字段纳入输入指纹，避免无关更新产生不必要的失效。
相同资料保存不增加版本时，不制造过期标记。

详情展示逐项要求、原文证据、来源版本、事实与推断、优势、差距、待确认事项及
用户纠正依据。历史按版本分页，有明确上限；摘要不携带完整简历正文。
首版保留现有列表默认排序，不用 A+ 评级替代 Today 服务端优先顺序。
展示历史时重新计算当前有效性；幂等重放响应也不能替代新鲜读取。

## 4. 实现顺序与验收

1. 已本地完成：独立领域 schema、输入清单与迁移、事务保存/幂等/不可变历史。
2. 已本地完成：候选读取和列表摘要、专用保存命令；保留已有候选字段与调用。
   MCP 与认证 Web GET 使用同一评估服务。Web 仍无评估写入端点。
3. 已本地完成：Jobs 列表与详情展示共用状态。后台模型匹配关闭时仍显示已保存的 ChatGPT 评级。
4. 待真实验收：真实 JD、明确基础简历及相关来源的保存、重新读取、另一会话读取一致，
   再验证资料不足、来源更新后的失效和有依据的用户纠正。

实现必须覆盖：跨 Workspace 访问拒绝、篡改身份无效、相同请求重放、变更请求幂等冲突、
并发版本冲突零写入、错误引文拒绝、无 JD 不评级、基础简历/来源变化失效、历史正文
保留，以及候选决定/申请/Tasks 零副作用。迁移须验证旧数据保留和重复启动。
模型是否正确理解岗位和经历，需要真实内容审阅，不能由引用子串测试代替。

## September 11 local implementation evidence

验证依照[最小充分证据政策](../VERIFICATION.md)。新迁移、MCP 命令和共享候选读取
是本包运行完整回归的具体触发条件。没有为了测试扩大到生产发布。

| 检查 | 实际结果 |
| --- | --- |
| `npx.cmd vitest run tests/integration/candidate-assessment.test.ts` | 14/14 通过，包含引用、权限、并发、历史、失效、缺失、分页/上限、迁移及两个独立 MCP 客户端 |
| `npm.cmd run typecheck` | 服务器及浏览器类型检查通过 |
| `npm.cmd test` | 初次完整回归 437/440 通过；三个失败的处理见下文，未把失败命令写成通过 |
| `npx.cmd vitest run tests/integration/resume-variants.test.ts tests/integration/p6-fixtures.test.ts` | 修正后 4/4 通过；重用其余未失效结果 |
| `npx.cmd vitest run tests/integration/resume-export.test.ts`，显式设置现有 `PAW_RESUME_PYTHON` | 1/1 通过，未安装解释器或修改导出代码 |
| `npm.cmd run build` | 生产构建通过；没有部署 |
| 差异、引用与脚本语法 | `git diff --check`、345 个本地引用、6 个新文件空白检查、两个更新后的 smoke 脚本 `node --check` 均通过 |

完整回归中的两个兼容性失败来自新增工具/迁移：P6 的固定工具数量更新为 31，
历史 migration 018 测试改用截至 018 的迁移目录，继续验证其原有数据保留断言。
第三个失败是当前终端 PATH 无 `python`；指定本机已有 Python 3.13 后导出测试通过。
最终 440 项测试均有通过证据，其中三个初次失败经定向复测解决；没有重复未失效的全套。
现有备份清单和 Gmail 工具发现断言同步到 019/31，完整回归中已通过。
生产 smoke 脚本也同步工具数量；本轮没有在生产运行这些脚本。

迁移验证使用合成数据库，检查旧候选和身份行保留、重复启动、旧迁移集合读取及新增
评估历史不可更新/删除。没有以此声称生产备份恢复、旧镜像恢复或真实资料验收已通过。
当前 MCP 两客户端测试为进程内合成验证；实际托管 ChatGPT 连接器、真实岗位推理质量、
最大响应的客户端可读性和网页评级渲染仍待验收。

早先设计阶段的 351 个本地引用检查是文档证据，不替代以上实现验证。
该存储包之后已完成下方的 Jobs 页面接入；发布与真实跨会话验收仍待完成。

## September 11 Jobs display follow-up

本包承接上一节的已验证存储与用户“请做”的页面实现要求。Jobs 列表展示有效评级
及主要理由，明确区分 JD 待补充、待评估、待重新评估；过期等级只在历史中展示。
详情直接使用同一评估服务的状态，默认读取最新评估快照，分开展示岗位原文、
经历证据和评估判断，并展示优势、差距、待确认项、用户纠正及资料版本。
来源链接打开外部当前页面；展开的快照正文保留评估时的内容。没有新增模型请求。

历史采用原有每页 10 条的服务端结果。只读页面接受 `assessmentVersion` 和
`historyBeforeVersion`，保留当前历史位置，并提供“返回最新评估”和“最近记录”。
无效、重复或越界参数拒绝；不存在的版本返回 404。历史选择不修改任何评估或候选。
服务端 HTML 转义模型/来源正文，外部来源链接复用原有 HTTP(S) 校验。

短期已验证收益：列表能比较保存结果，页面能从引用展开对应版本的来源快照，
能够翻页查看旧评级和用户纠正。长期继续为跨会话的岗位选择与准备保留依据；
真实岗位推理质量与实际节省时间仍需真实使用验收。

### Focused verification

- 本包仅改页面、样式和版本查询路由，未更改上一节的 schema、迁移、存储或 MCP
  契约。按 targeted-verification 选择页面及直接调用方检查，复用未失效的完整回归证据。
- `npx.cmd vitest run tests/integration/candidate-assessment-view.test.ts tests/integration/candidate-assessment.test.ts tests/integration/web-auth-transport.test.ts tests/integration/resume-variants.test.ts tests/integration/job-library.test.ts`：72/72 通过。
  覆盖状态一致、零读取写入、历史/来源版本、纠正、HTML 注入、危险来源 URL 及版本参数错误。
- 最后移除列表中重复的“JD 待补充”标签后，重新运行 `candidate-assessment-view.test.ts`：4/4 通过。
  其余未失效结果保留；两套 TypeScript 检查及生产构建通过。
- 本地 Chromium 实测 1365px 桌面、390px 窄屏的列表、详情和历史，无页面横向溢出。
  另通过真实 DOM 点击验证来源引用/快照展开、历史翻页、第一版历史评级和过期状态。
  最后窄屏检查可见页面元素的右边界均在视口内。
- Browser 插件执行工具连续两次在启动阶段报 kernel-assets 路径不存在，尚未建立
  浏览器会话。改用本机 Chrome 的独立临时无界面实例完成上述检查，未读取用户浏览器资料。
  第一轮普通命令行截图的窄屏视口不准确，改为显式视口设置后重新检查；不将那批截图计入窄屏通过证据。

可重复合成预览：`node --import tsx tests/manual/candidate-assessment-preview.ts --synthetic`。
只使用新建合成数据，在随机 loopback 端口输出列表/当前/过期示例 URL；输入 `quit`
关闭。随机端口及启动失败检查避免误连上一预览实例。本轮预览进程在检查后关闭。

未重复全套测试、没有生产发布或真实岗位写入：本包不改变底层共享契约，相关检查
已提供充分证据。实际发布仍须运行适用发布门禁、019 恢复验证及连接器发现检查；
真实 JD、简历/经历来源和评估质量不得以合成例子冒充验收。

## September 11 authorized release preparation

用户明确要求“请上线”，授权将上述存储和 Jobs 展示发布到现有生产实例。
本包承接已完成的本地实现，使 GPT 保存的评级可在生产网站读取；接下来才能
验收真实 JD、资料版本和跨会话读取。近期收益是已验证发布输入与明确恢复入口，
长期继续保留可追溯的岗位选择依据。此处尚未宣称生产功能可用；不创建真实评级、
申请或任务，不启用外部匹配，也不改变既有 Gmail/Web 授权范围。

正式发布是 VERIFICATION.md 的 Level 3 触发条件。设置已有
`PAW_RESUME_PYTHON=C:/Users/maki8/AppData/Local/Programs/Python/Python313/python.exe`
后，`npm.cmd run verify` 一次通过 **58 个文件、444 项测试、两套类型检查和生产构建**。
保留上一节桌面/窄屏及历史交互证据，没有因文档更新重复运行全套。

恢复脚本增加 `--candidate-assessments-upgrade`，调用 019 的增量迁移验证器；
同时采用 [018 生产教训](RESUME_VARIANTS.md#r1-production-acceptance--september-11)
中的隔离可写目录挂载，允许 SQLite 为只读查询创建 WAL sidecar。
源备份不会直接挂入验证容器，新旧镜像仍只启动隔离副本。
实际生产副本演练尚未执行，不将脚本静态检查冒充恢复成功。

当前访问证据：AWS CLI 可见 `paw-mvp` 正常运行；已有网站
`npm.cmd run web:check -- --origin https://workspace.ai-radar-lab.com --writes off`
的五项检查全部通过，证明的是既有运行版本。SSH 在临时限定当前操作者 `/32`
访问及沙箱外重试后仍超时，临时规则已删除；原有 SSH CIDR、`lightsail-connect`
别名和 HTTPS 规则保留。未判断超时由 UFW 引起。Browser 工具仍在启动阶段报
kernel-assets 路径不存在，无法建立用于 AWS 浏览器 SSH 的控制连接。
用户已获知需恢复浏览器连接；发布授权仍有效，无需再次申请上线许可。

### Remaining release sequence

1. 恢复服务器访问，读取 `/srv/paw/deployments/active-image-tag` 和实际容器镜像，
   核对当前基线；文档最后记录为 `application-resume-ui-20260911-r1`。
2. 从固定源码提交构建候选镜像 `candidate-grades-20260911-r1`，核对传输归档 SHA-256。
   在既有实例执行一致备份，使用返回的真实备份名运行
   `sudo bash deploy/cloud/rehearse-database-copy.sh BACKUP_NAME candidate-grades-20260911-r1 PREVIOUS_TAG --candidate-assessments-upgrade`。
   必须通过新镜像迁移、重复启动、旧镜像读取升级副本和原有表/行保留验证。
3. 切换前留存最新一致备份和停止后的完整数据库副本，保留 `/srv/paw` 挂载、
   原有身份和密钥文件；沿用 base + Web read + Gmail 三个 compose 文件。
   失败恢复旧应用镜像并保留升级数据库，不以旧数据库覆盖实时数据。
4. 停止候选容器后对隔离的前后副本运行
   `node dist/scripts/verify-candidate-assessments-migration.js BEFORE AFTER`，
   验证 019 为唯一增加且所有既有业务表、行和迁移记录保留；启动后核对健康状态。
5. 执行公网五项检查、认证 Jobs 页面读取和 MCP 31 工具发现/候选读取，
   记录实际镜像、提交、备份、迁移及数据保留证据。真实评级保存及刷新后 ChatGPT
   连接器使用体验单独验收，不能用伪造生产评级完成发布测试。

截至本记录，尚未上传源码、构建云端镜像、执行生产备份/迁移或切换容器。

### Pinned release input

- 源码提交：`6fef9b7710fa4c3be6122d094d0af5afe74fc503`。
- `git archive --format=tar` 的 SHA-256：
  `651777c935094782d34557c29c7256110757fb9944d63b0f4bb122ff30768a70`。
- 本地暂存：`%TEMP%/paw-candidate-grades-20260911-r1/source.tar`；
  可从固定提交重新生成，不包含未提交的 `.agents` 编辑。
- 恢复脚本以 LF 输入通过 `bash -n`；提交差异空白检查通过。
  发布记录后续仅文档变更不改变上述已验证的运行输入。
