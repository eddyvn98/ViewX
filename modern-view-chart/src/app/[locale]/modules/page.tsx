import type { Metadata } from 'next';
import { ModuleHubClient } from './ModuleHubClient';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Module Hub | vivutrade',
    description: 'Quản lý module đã mua và mở đúng hướng dẫn theo từng module.',
  };
}

export default async function ModuleHubPage({ params }: PageProps) {
  const { locale } = await params;
  return <ModuleHubClient locale={locale} />;
}
