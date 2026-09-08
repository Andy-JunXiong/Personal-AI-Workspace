# 邮件更新状态布局

状态：已发布 `mail-layout-20260908-r2`，本地布局检查、云端副本演练、线上数据库一致性和 HTTPS 检查通过。2026-09-08。

## Continuity and benefits

- Upstream requirement：用户指出[邮件处理一致性版本](MAIL_INGESTION_ALIGNMENT_2026-09-08.md)的扫描面板过于紧凑、信息太多。网页应以查看申请与待办为主。
- Current package：每日扫描和网页补查各用一张可展开的状态卡。默认只显示状态、最近检查时间和详情入口；范围、原始失败说明、写入统计和历史记录按需展开。本地时间替代直接显示 ISO 时间戳，精确值保留在 time datetime 属性中。
- Downstream enablement：可直接检查更新时效，再按需追溯检查范围。发布只包含视图与 CSS；邮件处理、数据库结构、连接权限和暂停的定时任务保持原状态。
- Short-term benefits：桌面合成数据预览中，两张收起状态卡各约 116px 高；原始长错误不再默认占据页面。390px 窄屏显示为单列，卡片内文字与操作入口无横向溢出。
- Long-term benefits：持续保留可追溯记录，同时让运维信息与日常查看内容各有清晰的信息层级；不以隐藏详细信息伪装检查成功。

## 验证

- 类型检查、生产构建通过；现有 mail-scan、mail-ingestion、mail-batch 三个测试文件共 28 项通过，覆盖真实状态表达、HTML 转义和纯读取边界。
- 本地合成预览验证桌面收起/展开及 390px 同源 iframe 窄屏；不是实体手机验收。预览仅使用合成内存数据库，未读取或扫描 Gmail。
- `tests/manual/web-preview.ts` 增加部分完成回执与窄屏演示入口。仅该本地演示允许同源 framing；生产认证和 CSP 不变，测试文件不进入发布包。
- 发布包只含 `src/web/views.ts`、`src/web/assets/workspace.css`，覆盖现有部署源码的独立副本，不覆盖旧发布目录。
- 归档 SHA-256：`08a02c36cfc1e4f850f5310497eb3e3000371308552e325493bdc6e18d7446fa`。

## 发布证据

- 现有 Lightsail `paw-mvp`，源码 `/opt/paw-mail-layout-20260908`，镜像 `paw:mail-layout-20260908-r1`，SHA-256 `1db743bb4c59075bd52b6c9ae50bcb3e745ffc1a3cc297ed4c89a7e55bbe5bcd`。
- 备份 `/srv/paw/backups/workspace-20260908T015234Z.db`；新旧镜像副本启动均 healthy，28 张表 / 239 行保持不变。
- 线上切换前后完整逻辑指纹一致；数据库仍为 migrations 001–011，没有新迁移。旧镜像 `mail-ingestion-20260908-r1` 保留，可按原 overlays 回退。
- 现有 read + Gmail overlays 保留；容器 health、网页 listener 与公开 `web:check --writes off` 全部通过。
- 临时私有 S3 传输对象已删除；本轮未执行邮件检查或更改定时任务。
- 11:55 Australia/Sydney 登录生产今日页验证：两张卡默认收起，各高 116px；每日记录为 9月7日 20:48「检查不完整」，网页记录为 9月8日 11:32「补查不完整」，没有改变真实状态。展开检查发现补查详情内容遗漏，已恢复，并补充范围起点、申请链接及全邮箱边界的回归断言。
- 最终修正版 `mail-layout-20260908-r2`，源码 `/opt/paw-mail-layout-20260908-r2`，镜像 SHA-256 `d0875f9efdba699b00fab7550e9cc7e5614df710423811ed88cca6fe33a53d8c`。视图文件规范化 LF 后 SHA-256 `9c5dce8e1c4edaddf428f8099e709ec2ba4c32b017f998bf1e40781713b28d7d` 与本地验证文件一致。
- 修正版重新通过 12 项相关集成测试、类型检查、构建；桌面和 390px 展开预览均显示两邮箱范围与申请链接。再次运行新旧镜像副本演练和线上逻辑指纹比较，28 张表 / 239 行不变；公开 HTTPS 检查通过。
- 12:02 Australia/Sydney 重新登录生产验证，展开网页补查卡片后可读到两邮箱 9月6日 11:32 至 9月8日 11:32 的范围、邮箱 1 的不完整说明及对应申请链接。精确时间保留在 datetime 属性，数据库状态未改变。
- GitHub 发布前对最终代码再次执行 `npm.cmd run verify`，36 个测试文件、291 项测试、双端类型检查和构建全部通过。版本、公开文档范围及剩余事项汇总在[最终交接](RELEASE_HANDOFF_2026-09-08.md)。
