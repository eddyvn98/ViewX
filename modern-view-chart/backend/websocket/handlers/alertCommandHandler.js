import { bridgeRegistry } from "../bridgeRegistry.js";
import { safeSend } from "../wsSend.js";

// Forward alert commands to MT5 Bridge
export function handleAlertCommand(context, data) {
    const { ws, clients, routeTarget } = context;
    const bridgeWs = bridgeRegistry.getPrimarySocket(routeTarget || {}, clients);

    if (!bridgeWs) {
        safeSend(ws, JSON.stringify({
            topic: "error",
            code: "bridge_not_found",
            detail: "no_bridge_available_for_alert_command",
        }));
        return;
    }

    safeSend(bridgeWs, JSON.stringify(data));
    console.log(`[ALERT] Forwarded ${data.command} command to MT5 Bridge`);
}
