export function handleStrategySignal({ clients }, data) {
    // data: { topic: "strategy_signal", data: { signal: "BUY", symbol: "..." } }

    console.log(`🧠 Strategy Signal: ${data.data.signal} on ${data.data.symbol}`);

    const payload = JSON.stringify({
        topic: "strategy_alert",
        signal: data.data
    });

    for (const [clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
