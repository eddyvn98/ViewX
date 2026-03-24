import { PlanVideoScroll } from '@/features/landing/components/PlanVideoScroll';
import { Metadata } from 'next';

type Props = {
    params: Promise<{ locale: string; planKey: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { planKey } = await params;
    return {
        title: `Explore ${planKey.toUpperCase()} Plan | vivutrade`,
        description: `Deep dive into the features of our ${planKey} plan with an interactive experience.`,
    };
}

export default async function PlanDetailPage({ params }: Props) {
    const { planKey } = await params;

    return (
        <main className="h-screen w-full overflow-hidden bg-black">
            <PlanVideoScroll planKey={planKey} />
        </main>
    );
}
