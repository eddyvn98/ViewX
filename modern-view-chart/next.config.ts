import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Cấu hình cơ bản, có thể thêm các option khác ở đây
};

export default withNextIntl(nextConfig);
