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
  poster?: string;
};

type LocalizedGuide = Omit<ModuleGuideContent, 'module'>;

type GuideMap = Record<ClientModule, { vi: LocalizedGuide; en: LocalizedGuide }>;

function getLocale(locale: string): Locale {
  return locale.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

const GUIDES: GuideMap = {
  your_mt5: {
    vi: {
      badge: 'Your MT5',
      title: 'Mở khóa MT5 local ngay trong chart với cùng một tài khoản đã mua module.',
      summary: 'Cài app native, đăng nhập đúng tài khoản VivuTrade, mở MT5 trên cùng máy và quay lại chart để dùng terminal.',
      primaryCta: {
        label: 'Tải app desktop native',
        href: '/downloads/desktop-native/Vivutrade%20Desktop%20Native%20Setup%201.0.0.exe',
        download: true,
      },
      secondaryCta: { label: 'Mở chart', href: '/chart' },
      sections: [
        {
          eyebrow: 'Thiết lập',
          title: '4 bước là chạy được',
          items: [
            'Cài VivuTrade Desktop Native trên máy chạy MT5.',
            'Đăng nhập app bằng đúng tài khoản đã mua module.',
            'Mở MT5 trên cùng máy và đăng nhập tài khoản giao dịch.',
            'Quay lại chart để kiểm tra dữ liệu và terminal.',
          ],
        },
        {
          eyebrow: 'Kiểm tra nhanh',
          title: 'Dấu hiệu đã đúng luồng',
          items: [
            'App desktop đăng nhập đúng tài khoản.',
            'Chart đã nhận tài khoản MT5 và giá realtime.',
            'Terminal mở được ngay trong chart.',
          ],
        },
      ],
      poster: '/images/modules/mt5_banner.png',
    },
    en: {
      badge: 'Your MT5',
      title: 'Unlock local MT5 directly inside the chart with the same purchased account.',
      summary: 'Install the native app, sign in with the correct VivuTrade account, open MT5 on the same machine, and return to the chart.',
      primaryCta: {
        label: 'Download desktop native app',
        href: '/downloads/desktop-native/Vivutrade%20Desktop%20Native%20Setup%201.0.0.exe',
        download: true,
      },
      secondaryCta: { label: 'Open chart', href: '/chart' },
      sections: [
        {
          eyebrow: 'Setup',
          title: '4 steps to go live',
          items: [
            'Install VivuTrade Desktop Native on the MT5 machine.',
            'Sign in with the account that purchased the module.',
            'Open MT5 and sign in to your trading account.',
            'Return to the chart and verify terminal access.',
          ],
        },
      ],
    },
  },
  binance_trade: {
    vi: {
      badge: 'Binance Demo',
      title: 'Mô phỏng giao dịch crypto realtime để test chiến lược an toàn.',
      summary: 'Phù hợp để luyện thao tác và kiểm tra hành vi lệnh trước khi giao dịch thật.',
      primaryCta: { label: 'Mở chart', href: '/chart' },
      sections: [
        {
          eyebrow: 'Phù hợp khi',
          title: 'Bạn muốn test trước khi vào lệnh thật',
          items: ['Theo dõi giá realtime.', 'Giả lập vị thế trong chart.', 'Đánh giá phản ứng chiến lược.'],
        },
      ],
    },
    en: {
      badge: 'Binance Demo',
      title: 'Simulate realtime crypto trading to test strategies safely.',
      summary: 'Best for practice and order-behavior validation before going live.',
      primaryCta: { label: 'Open chart', href: '/chart' },
      sections: [{ eyebrow: 'Best for', title: 'Testing before real trading' }],
    },
  },
  vn_gold: {
    vi: {
      badge: 'Giá vàng Việt Nam',
      title: 'Theo dõi giá SJC và DOJI ngay trong app.',
      summary: 'Xem nhanh giá mua và bán trong market list, không cần mở nhiều website.',
      primaryCta: { label: 'Mở chart', href: '/chart' },
      sections: [
        {
          eyebrow: 'Bạn nhận được',
          title: 'Nguồn giá quen thuộc',
          items: ['Giá SJC mua/bán.', 'Giá DOJI mua/bán.', 'Thêm vào watchlist để theo dõi nhanh.'],
        },
      ],
    },
    en: {
      badge: 'VN Gold',
      title: 'Track SJC and DOJI quotes directly in the app.',
      summary: 'Quickly view domestic gold buy/sell prices in one place.',
      primaryCta: { label: 'Open chart', href: '/chart' },
      sections: [{ eyebrow: 'What you get', title: 'Familiar local gold sources' }],
    },
  },
  telegram_notify: {
    vi: {
      badge: 'Telegram Notify',
      title: 'Nhận cảnh báo và tín hiệu quan trọng qua Telegram.',
      summary: 'Không cần canh chart liên tục, bot sẽ gửi cảnh báo đúng thời điểm.',
      primaryCta: { label: 'Mở chart', href: '/chart' },
      sections: [
        {
          eyebrow: 'Giá trị chính',
          title: 'Cập nhật đúng lúc',
          items: ['Alert giá và tín hiệu.', 'Thông báo thay đổi quan trọng.', 'Phản ứng nhanh hơn khi có biến động.'],
        },
      ],
    },
    en: {
      badge: 'Telegram Notify',
      title: 'Receive important alerts and signals in Telegram.',
      summary: 'Stay informed without constantly watching the chart.',
      primaryCta: { label: 'Open chart', href: '/chart' },
      sections: [{ eyebrow: 'Core value', title: 'Right update at the right time' }],
    },
  },
  telegram_control: {
    vi: {
      badge: 'Telegram Control',
      title: 'Điều khiển nhanh workflow từ xa qua Telegram.',
      summary: 'Phù hợp khi bạn cần thao tác nhanh dù không ngồi trước chart.',
      primaryCta: { label: 'Mở chart', href: '/chart' },
      sections: [
        {
          eyebrow: 'Dành cho ai',
          title: 'Người cần tốc độ phản ứng',
          items: ['Gửi thao tác nhanh qua bot.', 'Giảm độ trễ phản hồi.', 'Giữ nhịp làm việc linh hoạt.'],
        },
      ],
    },
    en: {
      badge: 'Telegram Control',
      title: 'Run quick remote workflows via Telegram.',
      summary: 'Ideal when you need fast actions away from the chart.',
      primaryCta: { label: 'Open chart', href: '/chart' },
      sections: [{ eyebrow: 'Best for', title: 'Fast remote response' }],
    },
  },
  discord_bot: {
    vi: {
      badge: 'Discord Bot',
      title: 'Tự động hóa thông báo và thao tác qua Discord bot.',
      summary: 'Đồng bộ cảnh báo vào kênh Discord để team theo dõi tập trung.',
      primaryCta: { label: 'Mở chart', href: '/chart' },
      sections: [{ eyebrow: 'Giá trị chính', title: 'Tăng tốc luồng phối hợp trong team' }],
    },
    en: {
      badge: 'Discord Bot',
      title: 'Automate alerts and quick actions with a Discord bot.',
      summary: 'Sync notifications into Discord channels for team visibility.',
      primaryCta: { label: 'Open chart', href: '/chart' },
      sections: [{ eyebrow: 'Core value', title: 'Faster team coordination' }],
    },
  },
  ai_assistant: {
    vi: {
      badge: 'AI Assistant',
      title: 'Rút ngắn thời gian phân tích với lớp trợ lý AI trong app.',
      summary: 'Tóm tắt bối cảnh chart và tín hiệu nhanh hơn để hỗ trợ ra quyết định.',
      primaryCta: { label: 'Mở chart', href: '/chart' },
      sections: [{ eyebrow: 'Điểm mạnh', title: 'Hiểu nhanh bối cảnh trước khi quyết định' }],
    },
    en: {
      badge: 'AI Assistant',
      title: 'Speed up analysis with AI assistance inside the app.',
      summary: 'Quickly summarize chart context and signals to support decisions.',
      primaryCta: { label: 'Open chart', href: '/chart' },
      sections: [{ eyebrow: 'Strength', title: 'Faster context understanding' }],
    },
  },
};

export function getModuleGuideContent(module: ClientModule, locale: string): ModuleGuideContent {
  const lang = getLocale(locale);
  const localized = GUIDES[module]?.[lang] || GUIDES[module]?.en;

  return {
    module,
    badge: localized.badge,
    title: localized.title,
    summary: localized.summary,
    primaryCta: localized.primaryCta,
    secondaryCta: localized.secondaryCta,
    sections: localized.sections,
    poster: (localized as any).poster,
  };
}

export function renderGuideSection(section: ModuleGuideSection) {
  return (
    <section key={`${section.eyebrow || section.title}`} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl md:p-7">
      {section.eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300">{section.eyebrow}</p> : null}
      <h2 className="mt-3 text-xl font-black tracking-tight text-white md:text-2xl">{section.title}</h2>
      {section.body ? <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">{section.body}</p> : null}
      {section.items?.length ? (
        <ul className="mt-4 space-y-3">
          {section.items.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-6 text-slate-200 md:text-base">
              <span className="mt-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
