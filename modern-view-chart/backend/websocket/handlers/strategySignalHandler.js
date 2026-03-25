import { bridgeRegistry } from "../bridgeRegistry.js";

export function handleStrategySignal({ ws, clients, routeTarget }, data) {
    // data: { topic: "strategy_signal", data: { signal: "BUY", symbol: "..." } }

    console.log(`🧠 Strategy Signal: ${data.data?.signal} on ${data.data?.symbol}`);

    const payload = JSON.stringify({
        topic: "strategy_alert",
        signal: data.data
    });

    const senderMeta = clients.get(ws);
    const recipients = bridgeRegistry.getTargetClientSockets(clients, routeTarget || senderMeta, { excludeWs: ws });
    for (const clientWs of recipients) {
        clientWs.send(payload);
    }
}
