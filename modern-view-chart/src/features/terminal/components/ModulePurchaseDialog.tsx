'use client';

import React from 'react';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';

type OrderPayload = {
    orderCode: string;
    amount: number;
    transferContent: string;
    qrUrl?: string;
    bankCode?: string;
    bankAccountNo?: string;
    bankAccountName?: string;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onTrialStart: () => Promise<void>;
    onCreateOrder: () => Promise<OrderPayload | null>;
    loading: boolean;
    trialEligible: boolean;
};

export function ModulePurchaseDialog({ open, onClose, onTrialStart, onCreateOrder, loading, trialEligible }: Props) {
    const [order, setOrder] = React.useState<OrderPayload | null>(null);

    React.useEffect(() => {
        if (!open) setOrder(null);
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-background p-4">
                <h3 className="text-sm font-bold">Mo khoa MT5 Terminal</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                    Dung thu 7 ngay hoac thanh toan bang QR chuyen khoan.
                </p>

                {order ? (
                    <div className="mt-3 space-y-2 text-xs">
                        <div className="rounded border border-border/70 bg-secondary/20 p-2">
                            <div>Ma don: <span className="font-mono font-semibold">{order.orderCode}</span></div>
                            <div>So tien: <span className="font-semibold">{order.amount.toLocaleString('vi-VN')} VND</span></div>
                            <div>Noi dung CK: <span className="font-mono">{order.transferContent}</span></div>
                            <div>Tai khoan: {order.bankAccountNo || '-'} ({order.bankCode || '-'})</div>
                        </div>
                        <div className="mx-auto w-fit rounded bg-white p-2">
                            {order.qrUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={order.qrUrl} alt="Payment QR" className="h-52 w-52 object-contain" />
                            ) : (
                                <QRCode value={order.transferContent} size={208} />
                            )}
                        </div>
                        <p className="text-[11px] text-amber-300">
                            Sau khi chuyen khoan, admin hoac SePay xac nhan thi quyen se duoc mo ngay.
                        </p>
                    </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                    {trialEligible ? (
                        <Button
                            disabled={loading}
                            variant="outline"
                            onClick={async () => {
                                await onTrialStart();
                                onClose();
                            }}
                        >
                            Dung thu 7 ngay
                        </Button>
                    ) : null}
                    <Button
                        disabled={loading}
                        onClick={async () => {
                            const next = await onCreateOrder();
                            if (next) setOrder(next);
                        }}
                    >
                        Tao QR thanh toan
                    </Button>
                    <Button disabled={loading} variant="ghost" onClick={onClose}>Dong</Button>
                </div>
            </div>
        </div>
    );
}
