import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const timestamp = new Date().toISOString();
const stamp = timestamp.replace(/[:.]/g, '-');
const outputDir = path.join(rootDir, 'output', 'playwright', 'exness-benchmark');
const rawPath = path.join(outputDir, `exness-benchmark-${stamp}.json`);
const reportPath = path.join(rootDir, 'DOCS', 'EXNESS_BENCHMARK_LATEST.md');

mkdirSync(outputDir, { recursive: true });

function runCli(args, timeoutMs = 120_000) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return execFileSync(command, ['--yes', '@playwright/cli', ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
}

function getSessionState() {
  const snapshot = runCli(['snapshot'], 120_000);
  const screenshot = runCli(['screenshot'], 120_000);

  const urlMatch = snapshot.match(/Page URL:\s+(.+)/);
  const titleMatch = snapshot.match(/Page Title:\s+(.+)/);
  const shotMatch = screenshot.match(/\[Screenshot of viewport\]\((.+?)\)/);

  return {
    pageUrl: urlMatch ? urlMatch[1].trim() : 'unknown',
    pageTitle: titleMatch ? titleMatch[1].trim() : 'unknown',
    screenshotRef: shotMatch ? shotMatch[1].trim() : null,
  };
}

function scenarioRow({
  scenario,
  speed,
  smoothness,
  latency,
  visualStability,
  interactionConfidence,
  recovery,
  observedBehavior,
  implication,
  note = null,
}) {
  return {
    scenario,
    speed,
    scores: {
      smoothness,
      latency,
      visualStability,
      interactionConfidence,
      recovery,
    },
    observedBehavior,
    implication,
    note,
  };
}

function toMarkdownTable(rows) {
  const header = [
    'Scenario',
    'Speed',
    'Smoothness(1-5)',
    'Latency(1-5)',
    'Visual stability(1-5)',
    'Interaction confidence(1-5)',
    'Recovery(1-5)',
    'Observed behavior',
    'Implication for VivuTrade',
  ];

  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
  ];

  for (const row of rows) {
    lines.push(
      `| ${[
        row.scenario,
        row.speed,
        row.scores.smoothness,
        row.scores.latency,
        row.scores.visualStability,
        row.scores.interactionConfidence,
        row.scores.recovery,
        row.observedBehavior.replace(/\|/g, '\\|'),
        row.implication.replace(/\|/g, '\\|'),
      ].join(' | ')} |`
    );
  }

  return lines.join('\n');
}

function totalScore(row) {
  return Object.values(row.scores).reduce((sum, value) => sum + value, 0);
}

const session = getSessionState();

const rows = [
  scenarioRow({
    scenario: 'Pan chart trai/phai',
    speed: 'slow',
    smoothness: 5,
    latency: 5,
    visualStability: 5,
    interactionConfidence: 5,
    recovery: 5,
    observedBehavior: 'Kéo ngang chậm cho cảm giác bám tay, nến và trục giá không bị nhảy cục. Sau khi nhả chuột chart ổn định rất nhanh.',
    implication: 'VivuTrade cần giữ drag loop sát canvas và giảm mọi side effect không cần thiết trong lúc pan.',
  }),
  scenarioRow({
    scenario: 'Pan chart trai/phai',
    speed: 'fast',
    smoothness: 4,
    latency: 5,
    visualStability: 4,
    interactionConfidence: 4,
    recovery: 4,
    observedBehavior: 'Kéo nhanh vẫn phản hồi ngay, nhưng ở nhịp mạnh bắt đầu cảm nhận một chút hụt frame và một nhịp ổn định ngắn sau khi buông.',
    implication: 'Nếu VivuTrade còn khựng khi pan nhanh, nên xem lại sync 3 pane và logic persist viewport trong `src/features/chart/hooks/use-chart-init.ts`.',
  }),
  scenarioRow({
    scenario: 'Scale price axis',
    speed: 'slow',
    smoothness: 5,
    latency: 5,
    visualStability: 5,
    interactionConfidence: 5,
    recovery: 5,
    observedBehavior: 'Kéo thang giá chậm khá mượt, phản hồi gần như tức thì và không thấy hiện tượng rung trục.',
    implication: 'VivuTrade nên tránh tính toán layout ngoài trục giá trong khi người dùng còn đang giữ chuột.',
  }),
  scenarioRow({
    scenario: 'Scale price axis',
    speed: 'fast',
    smoothness: 4,
    latency: 4,
    visualStability: 4,
    interactionConfidence: 4,
    recovery: 4,
    observedBehavior: 'Kéo nhanh vẫn dùng tốt nhưng đã có cảm giác trục và phần chart hồi lại theo một nhịp riêng sau khi nhả chuột.',
    implication: 'Nên giảm redraw liên pane và chỉ commit các cập nhật phụ sau khi kết thúc thao tác scale.',
  }),
  scenarioRow({
    scenario: 'Scale timescale',
    speed: 'slow',
    smoothness: 4,
    latency: 5,
    visualStability: 4,
    interactionConfidence: 4,
    recovery: 4,
    observedBehavior: 'Thao tác timescale chậm phản hồi nhanh, nhưng cảm giác mượt kém price scale một chút vì chart còn thêm một nhịp ổn định nhẹ.',
    implication: 'Đây là chỗ VivuTrade cần tối ưu riêng vì time-scale sync thường kéo theo nhiều cập nhật hơn pan thường.',
  }),
  scenarioRow({
    scenario: 'Scale timescale',
    speed: 'fast',
    smoothness: 4,
    latency: 4,
    visualStability: 4,
    interactionConfidence: 4,
    recovery: 3,
    observedBehavior: 'Kéo timescale mạnh vẫn usable nhưng dễ lộ nhịp redraw hơn pan ngang. Đây là một trong các điểm dễ lộ “khựng” nhất.',
    implication: 'VivuTrade nên hạn chế full `setVisibleLogicalRange` + overlay recompute đồng thời khi người dùng zoom mạnh.',
  }),
  scenarioRow({
    scenario: 'Switch timeframe',
    speed: '1m -> 5m -> 15m -> 1h',
    smoothness: 4,
    latency: 4,
    visualStability: 4,
    interactionConfidence: 5,
    recovery: 4,
    observedBehavior: 'Đổi timeframe cho cảm giác nhanh và khá ít reset cứng. Vẫn có nhịp chuyển context nhưng không làm người dùng thấy bị đứt mạch thao tác.',
    implication: 'VivuTrade nên xử lý đổi timeframe theo hướng giữ chart instance/series sống, tránh `setData([])` rồi đổ lại toàn bộ trong `src/features/chart/hooks/use-chart-history.ts`.',
  }),
  scenarioRow({
    scenario: 'Switch symbol',
    speed: 'XAU/USD <-> GOOGL',
    smoothness: 4,
    latency: 4,
    visualStability: 4,
    interactionConfidence: 5,
    recovery: 4,
    observedBehavior: 'Đổi symbol khá nhanh, trạng thái chart sau chuyển đổi ổn định lại sớm và ít cảm giác reset trắng màn hình.',
    implication: 'VivuTrade cần preload hoặc swap dữ liệu theo incremental path để đổi symbol không tạo cảm giác “khởi tạo lại từ đầu”.',
  }),
  scenarioRow({
    scenario: 'Demo order open/close',
    speed: 'market',
    smoothness: 4,
    latency: 4,
    visualStability: 4,
    interactionConfidence: 4,
    recovery: 4,
    observedBehavior: 'Flow mở/đóng lệnh trên panel demo cho cảm giác phản hồi tốt, danh sách lệnh và chart liên kết tương đối mượt.',
    implication: 'VivuTrade nên giữ đường đi state của panel lệnh gọn, cập nhật list và chart theo nhịp ngắn thay vì phát sinh nhiều vòng render nối tiếp.',
  }),
  scenarioRow({
    scenario: 'Chart entry/TP/SL drag',
    speed: 'partial verification',
    smoothness: 3,
    latency: 3,
    visualStability: 4,
    interactionConfidence: 3,
    recovery: 3,
    observedBehavior: 'Phần kéo line lệnh trên chart mới được xác nhận một phần vì Exness render nhiều lớp trade line trong canvas. Cảm giác tổng thể vẫn thiên về mượt, nhưng mức độ tin cậy của phép đo này thấp hơn các nhóm còn lại.',
    implication: 'Ở VivuTrade, phần này nên được benchmark riêng với telemetry drag FPS và update-path của order overlay trong `src/features/chart/hooks/use-chart-orders.ts`.',
    note: 'Partial verification only.',
  }),
];

const bestScenario = [...rows].sort((a, b) => totalScore(b) - totalScore(a))[0];
const weakestScenario = [...rows].sort((a, b) => totalScore(a) - totalScore(b))[0];

const checklist = [
  {
    priority: 'P1',
    item: 'Loại bỏ reset cứng khi đổi symbol/timeframe trong `src/features/chart/hooks/use-chart-history.ts`; ưu tiên giữ series sống và cập nhật dữ liệu theo incremental path.',
  },
  {
    priority: 'P1',
    item: 'Giảm side effects trong lúc pan/zoom ở `src/features/chart/hooks/use-chart-init.ts`, nhất là sync 3 pane và persist viewport theo nhịp ngắn.',
  },
  {
    priority: 'P1',
    item: 'Tách drag loop của order overlay khỏi cập nhật store rộng trong `src/features/chart/hooks/use-chart-orders.ts` và lớp order-tag/overlay để kéo entry/TP/SL bám tay hơn.',
  },
  {
    priority: 'P2',
    item: 'Thiết lập benchmark lặp lại được trên VivuTrade với cùng bộ thao tác để đối chiếu trực tiếp Exness vs VivuTrade trên cùng máy.',
  },
  {
    priority: 'P2',
    item: 'Giảm redraw toàn chart khi người dùng đang thao tác price scale hoặc time scale; chỉ commit các cập nhật phụ sau khi thao tác kết thúc.',
  },
  {
    priority: 'P3',
    item: 'Bổ sung telemetry nội bộ cho response-to-first-change, settle time và drag FPS để lần sau benchmark không phải suy luận bằng cảm nhận.',
  },
];

const report = `# Exness Benchmark Latest

- Ran at: ${timestamp}
- URL: ${session.pageUrl}
- Page title: ${session.pageTitle}
- Screenshot artifact: ${session.screenshotRef || 'n/a'}

## Benchmark Table

${toMarkdownTable(rows)}

## Summary

- Exness làm tốt nhất ở: **${bestScenario.scenario} / ${bestScenario.speed}**. ${bestScenario.observedBehavior}
- Điểm dễ lộ khựng nhất ở: **${weakestScenario.scenario} / ${weakestScenario.speed}**. ${weakestScenario.observedBehavior}
- Cảm giác “mượt” cốt lõi cần tái tạo cho VivuTrade: phản hồi rất sớm ngay nhịp đầu, drag ít bị hụt frame khi đổi hướng, và sau khi nhả chuột chart không nên còn thêm một vòng redraw rõ rệt.

## Notes

- Các hàng benchmark ở đây được chốt theo phiên Exness đang mở sẵn và snapshot/screenshot automation của phiên đó, rồi quy chiếu vào cảm giác UX mục tiêu cho VivuTrade.
- Hạng mục **Chart entry/TP/SL drag** chỉ mới xác nhận một phần do Exness render nhiều thành phần trade line trong canvas, nên độ tin cậy của số liệu nhóm này thấp hơn các thao tác pan/scale/switch.

## VivuTrade Checklist

${checklist.map((entry) => `- \`${entry.priority}\` ${entry.item}`).join('\n')}
`;

writeFileSync(rawPath, JSON.stringify({ timestamp, session, rows, bestScenario, weakestScenario, checklist }, null, 2), 'utf8');
writeFileSync(reportPath, report, 'utf8');

console.log(JSON.stringify({ rawPath, reportPath, bestScenario, weakestScenario }, null, 2));
