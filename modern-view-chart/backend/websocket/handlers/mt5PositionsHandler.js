export function handleMt5Positions({ clients }, data) {
    global.lastMt5State = {
        account: data.account,
        positions: data.positions,
        orders: data.orders || []
    };

    const payload = JSON.stringify({
        topic: "mt5_positions_update",
        account: data.account,
        positions: data.positions,
        orders: data.orders || []
    });

    for (const [clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
