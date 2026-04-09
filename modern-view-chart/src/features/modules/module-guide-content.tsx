import type { ReactNode } from 'react';
import type { ClientModule } from '@/lib/auth/entitlements';

type Locale = 'vi' | 'en';

export type ModuleGuideSection = {
  eyebrow?: string;
  title: string;
  body?: string;
  items?: string[];
};

export type ModuleGuideContent = {
  module: ClientModule;
  badge: string;
  title: string;
  summary: string;
  primaryCta: { label: string; href: string; download?: boolean };
  secondaryCta?: { label: string; href: string };
  sections: ModuleGuideSection[];
};

function getLocale(locale: string): Locale {
  return locale.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

export function getModuleGuideContent(module: ClientModule, locale: string): ModuleGuideContent {
  const lang = getLocale(locale);

  if (module === 'your_mt5') {
    return lang === 'vi'
      ? {
          module,
          badge: 'Your MT5',
          title: 'Mở MT5 trên máy của bạn và dùng trực tiếp trong chart.',
          summary:
            'Cài app native, đăng nhập đúng tài khoản đã mua module, mở MT5 trên cùng máy và quay lại chart để sử dụng.',
          primaryCta: {
            label: 'Tải app desktop native',
            href: '/downloads/desktop-native/Vivutrade%20Desktop%20Native%20Setup%201.0.0.exe',
            download: true,
          },
          secondaryCta: {
            label: 'Mở chart để dùng ngay',
            href: '/chart',
          },
          sections: [
            {
              eyebrow: 'Thiết lập',
              title: 'Chỉ cần 4 bước là bắt đầu được.',
              items: [
                'Cài VivuTrade Desktop Native trên đúng máy Windows đang chạy MT5.',
                'Đăng nhập app bằng tài khoản VivuTrade đã sở hữu module Your MT5.',
                'Mở MT5 trên cùng máy và đăng nhập tài khoản giao dịch.',
                'Quay lại chart để xem dữ liệu và dùng terminal. Nếu muốn tiếp tục dùng trên các thiết bị khác mọi lúc mọi nơi, hãy giữ app native luôn mở.',
              ],
            },
            {
              eyebrow: 'Kiểm tra nhanh',
              title: 'Ba dấu hiệu cho biết bạn đã vào đúng flow.',
              items: [
                'App desktop đã đăng nhập đúng tài khoản.',
                'Chart đã nhận được tài khoản MT5 và giá realtime.',
                'Terminal trong chart mở ra mà không cần thao tác thêm.',
              ],
            },
            {
              eyebrow: 'Nếu chưa thấy mở khóa',
              title: 'Hãy kiểm tra lại theo thứ tự đơn giản này.',
              items: [
                'Đăng xuất rồi đăng nhập lại trong desktop app bằng đúng tài khoản vừa mua module.',
                'Xác nhận MT5 đang mở trên cùng máy và đã đăng nhập đúng tài khoản giao dịch.',
                'Nếu app báo lỗi, mở lại app và thử lại sau vài giây.',
              ],
            },
          ],
        }
      : {
          module,
          badge: 'Your MT5',
          title: 'Open MT5 on your machine and use it directly inside the chart.',
          summary:
            'Install the native app, sign in with the account that purchased the module, open MT5 on the same machine, and return to the chart.',
          primaryCta: {
            label: 'Download native desktop app',
            href: '/downloads/desktop-native/Vivutrade%20Desktop%20Native%20Setup%201.0.0.exe',
            download: true,
          },
          secondaryCta: {
            label: 'Open chart now',
            href: '/chart',
          },
          sections: [
            {
              eyebrow: 'Setup',
              title: 'You only need four clear steps.',
              items: [
                'Install VivuTrade Desktop Native on the Windows machine that runs MT5.',
                'Sign in with the VivuTrade account that owns the Your MT5 module.',
                'Open MT5 on the same machine and sign in to the trading account.',
                'Return to the chart to use it. If you want access from other devices anytime, keep the native app open.',
              ],
            },
            {
              eyebrow: 'Quick check',
              title: 'Three signs that you are in the right flow.',
              items: [
                'The desktop app is signed in with the correct account.',
                'The chart already shows the MT5 account and realtime prices.',
                'The terminal inside the chart opens without extra steps.',
              ],
            },
            {
              eyebrow: 'If it still looks locked',
              title: 'Check these simple steps first.',
              items: [
                'Sign out and sign back in inside the desktop app with the same purchased account.',
                'Confirm MT5 is open on the same machine and signed into the intended trading account.',
                'If the app reports an error, reopen it and try again after a few seconds.',
              ],
            },
          ],
        };
  }

  const shared = {
    binance_trade: {
      vi: {
        badge: 'Binance Demo',
        title: 'Mô phỏng giao dịch crypto realtime để luyện chiến lược và kiểm tra hành vi lệnh.',
        summary:
          'Module này phù hợp cho trải nghiệm demo trong chart với dữ liệu realtime và vị thế mô phỏng, giúp user thử nhanh trước khi đi vào tài khoản thật.',
        sections: [
          {
            eyebrow: 'Phù hợp khi',
            title: 'Bạn muốn thử chiến lược trước khi giao dịch thật.',
            items: [
              'Xem dữ liệu crypto realtime trong chart.',
              'Theo dõi vị thế mô phỏng và cách lệnh phản ứng.',
              'Dùng như môi trường demo để làm quen sản phẩm.',
            ],
          },
          {
            eyebrow: 'Cách dùng',
            title: 'Mở chart và chọn luồng Binance Demo trong terminal.',
            body: 'Không cần cài thêm gì trên máy. Chỉ cần module đã hoạt động trên đúng tài khoản là có thể dùng ngay.',
          },
        ],
      },
      en: {
        badge: 'Binance Demo',
        title: 'Simulate crypto trading with realtime market data for practice and order-flow testing.',
        summary:
          'This module is built for demo trading inside the chart with realtime data and simulated positions, so users can test quickly before going live.',
        sections: [
          {
            eyebrow: 'Best for',
            title: 'Use it when you want to test a strategy before trading live.',
            items: [
              'Watch realtime crypto market data inside the chart.',
              'Track simulated positions and how orders behave.',
              'Use it as a safe product onboarding environment.',
            ],
          },
          {
            eyebrow: 'How to use it',
            title: 'Open the chart and switch the terminal into Binance Demo mode.',
            body: 'No extra local setup is required. Once the module is active on the right account, it is ready inside the chart.',
          },
        ],
      },
    },
    telegram_notify: {
      vi: {
        badge: 'Telegram Notify',
        title: 'Nhận cảnh báo và tín hiệu quan trọng trên Telegram cá nhân của bạn.',
        summary:
          'Module này giúp user không bỏ lỡ diễn biến quan trọng khi rời màn hình bằng cách đưa các cảnh báo cần thiết tới Telegram.',
        sections: [
          {
            eyebrow: 'Giá trị chính',
            title: 'Nhận đúng thông tin vào đúng thời điểm.',
            items: [
              'Cảnh báo tín hiệu và giá chạm mức.',
              'Theo dõi các thay đổi quan trọng mà không phải nhìn chart liên tục.',
              'Tăng tốc độ phản ứng khi có diễn biến mới.',
            ],
          },
          {
            eyebrow: 'Cách bắt đầu',
            title: 'Liên kết Telegram trong app rồi chọn loại thông báo bạn muốn nhận.',
            body: 'Sau khi module hoạt động, user có thể bật hoặc tắt từng nhóm thông báo tùy nhu cầu.',
          },
        ],
      },
      en: {
        badge: 'Telegram Notify',
        title: 'Receive important alerts and signals in your personal Telegram.',
        summary:
          'This module helps users stay informed when away from the screen by sending the most useful alerts directly to Telegram.',
        sections: [
          {
            eyebrow: 'Core value',
            title: 'Get the right update at the right moment.',
            items: [
              'Signal alerts and price-level notifications.',
              'Follow important changes without staring at the chart.',
              'React faster when something changes.',
            ],
          },
          {
            eyebrow: 'Getting started',
            title: 'Link Telegram in the app and choose the notification types you want.',
            body: 'Once the module is active, the user can enable or disable each group of notifications as needed.',
          },
        ],
      },
    },
    telegram_control: {
      vi: {
        badge: 'Telegram Control',
        title: 'Điều khiển nhanh hơn qua Telegram khi bạn không ngồi trước chart.',
        summary:
          'Module này phù hợp cho user muốn thao tác nhanh và theo dõi từ xa mà vẫn giữ được nhịp làm việc gọn gàng.',
        sections: [
          {
            eyebrow: 'Dành cho ai',
            title: 'Phù hợp với user cần phản ứng nhanh và làm việc linh hoạt hơn.',
            items: [
              'Gửi thao tác nhanh qua Telegram.',
              'Rút ngắn thời gian phản hồi khi có tình huống mới.',
              'Giữ được nhịp làm việc ngay cả khi đang ở ngoài chart.',
            ],
          },
          {
            eyebrow: 'Cách bắt đầu',
            title: 'Bắt đầu từ phần liên kết Telegram và cấu hình bot control.',
            body: 'Sau khi module được cấp quyền, user có thể dùng popup này như điểm bắt đầu để hiểu đúng cách vận hành.',
          },
        ],
      },
      en: {
        badge: 'Telegram Control',
        title: 'Work faster through Telegram when you are away from the chart.',
        summary:
          'This module is designed for users who want faster actions and lighter remote workflows without losing continuity.',
        sections: [
          {
            eyebrow: 'Best for',
            title: 'Use it when you need quicker reactions and more flexible operation.',
            items: [
              'Send quick actions through Telegram.',
              'Reduce response time when something changes.',
              'Keep the workflow moving even when away from the chart.',
            ],
          },
          {
            eyebrow: 'Getting started',
            title: 'Start with Telegram linking and the control-bot setup.',
            body: 'Once the module is active, this guide becomes the lightweight entry point for understanding how to use it properly.',
          },
        ],
      },
    },
    ai_assistant: {
      vi: {
        badge: 'AI Assistant',
        title: 'Dùng AI để đọc nhanh bối cảnh chart và hỗ trợ quyết định rõ ràng hơn.',
        summary:
          'Module này giúp user hiểu tín hiệu, trạng thái chiến lược và tình huống giao dịch nhanh hơn bằng một lớp hỗ trợ AI ngay trong sản phẩm.',
        sections: [
          {
            eyebrow: 'Điểm mạnh',
            title: 'AI giúp rút ngắn thời gian đọc bối cảnh, không thay user ra quyết định.',
            items: [
              'Tóm tắt trạng thái chiến lược và vị thế.',
              'Giảm thời gian phải đọc thủ công nhiều lớp dữ liệu.',
              'Hữu ích cho review nhanh trước khi quyết định.',
            ],
          },
          {
            eyebrow: 'Cách dùng',
            title: 'Mở panel AI trong chart hoặc dashboard khi module đã hoạt động.',
            body: 'Flow này hiệu quả nhất khi user đã có câu hỏi rõ ràng và muốn đọc nhanh tình huống hiện tại.',
          },
        ],
      },
      en: {
        badge: 'AI Assistant',
        title: 'Use AI to read chart context faster and support clearer decisions.',
        summary:
          'This module helps users understand signals, strategy state, and trading situations faster with an AI support layer inside the product.',
        sections: [
          {
            eyebrow: 'Strength',
            title: 'AI shortens context-reading time without replacing the user decision.',
            items: [
              'Summarize strategy and position state.',
              'Reduce the time spent reading multiple data layers manually.',
              'Useful for fast review before making a decision.',
            ],
          },
          {
            eyebrow: 'How to use it',
            title: 'Open the AI panel inside the chart or dashboard once the module is active.',
            body: 'The flow works best when the user already has a clear question and wants a faster read on the current situation.',
          },
        ],
      },
    },
  } as const;

  const fallback = shared[module];
  const localized = fallback[lang];

  return {
    module,
    badge: localized.badge,
    title: localized.title,
    summary: localized.summary,
    primaryCta: {
      label: lang === 'vi' ? 'Mở chart' : 'Open chart',
      href: '/chart',
    },
    secondaryCta: {
      label: lang === 'vi' ? 'Xem pricing' : 'View pricing',
      href: '/pricing',
    },
    sections: localized.sections.map((section) => ({
      ...section,
      items: 'items' in section && section.items ? [...section.items] : undefined,
    })),
  };
}

export function renderGuideSection(section: ModuleGuideSection): ReactNode {
  return (
    <section key={`${section.eyebrow || ''}-${section.title}`} className="rounded-[28px] border border-white/10 bg-slate-950/75 p-6">
      {section.eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-300/90">{section.eyebrow}</p>
      ) : null}
      <h2 className="mt-3 text-2xl font-black tracking-tight text-white">{section.title}</h2>
      {section.body ? <p className="mt-3 text-sm leading-7 text-slate-300 md:text-[15px]">{section.body}</p> : null}
      {section.items?.length ? (
        <ul className="mt-4 space-y-3">
          {section.items.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-7 text-slate-200 md:text-[15px]">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
