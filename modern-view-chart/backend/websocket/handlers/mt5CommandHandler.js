export function handleMt5Command({ clients }, data) {
    const payload = JSON.stringify(data);
    for (const [clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
