export function handleAuth({ ws, clients }, data) {
    const clientData = clients.get(ws);
    if (clientData) {
        clientData.userId = data.userId || null;
    }

    if (global.lastMt5State) {
        ws.send(JSON.stringify({
            topic: "mt5_positions_update",
            account: global.lastMt5State.account,
            positions: global.lastMt5State.positions
        }));
    }
}
