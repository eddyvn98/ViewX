export function createTelegramBotRenderers(deps) {
  const {
    escapeHtml,
    escapeDot,
    escapeXml,
    formatTimestamp,
    formatPrice,
    getStrategies,
    getSignals,
    getVirtualPositions,
    normalizeSymbol,
    normalizeMatrixTimeframe,
    buildMatrixScopeKey,
    sendTelegramPhotoBuffer,
    sendTelegramDocumentBuffer,
    sendTelegramDocument,
    sendTelegramPhoto,
  } = deps;

  function truncateText(value, maxLength) {
    const text = String(value || "");
    if (text.length <= maxLength) return text;
    if (maxLength <= 1) return text.slice(0, maxLength);
    return `${text.slice(0, maxLength - 1)}…`;
  }

  function padCell(value, width) {
    const text = truncateText(String(value || ""), width);
    return text.padEnd(width, " ");
  }

  function buildSignalRow(signal, strategiesById = new Map()) {
    const strategyName = strategiesById.get(signal.strategyId) || signal.strategyId || "strategy";
    const timestampLabel = formatTimestamp(signal.timestamp).replace(",", "");
    return {
      type: String(signal.type || "-").toUpperCase(),
      symbol: String(signal.symbol || "-"),
      timeframe: String(signal.timeframe || "-"),
      strategy: String(strategyName || "strategy"),
      price: formatPrice(signal.price),
      timestamp: timestampLabel,
    };
  }

  function renderSignalsTable(signals, strategiesById) {
    const rows = signals.map((signal) => buildSignalRow(signal, strategiesById));
    const widths = {
      type: 8,
      symbol: 10,
      timeframe: 6,
      strategy: 16,
      price: 11,
      timestamp: 19,
    };
    const header = [
      padCell("TYPE", widths.type),
      padCell("SYMBOL", widths.symbol),
      padCell("TF", widths.timeframe),
      padCell("STRATEGY", widths.strategy),
      padCell("PRICE", widths.price),
      padCell("TIME", widths.timestamp),
    ].join(" | ");

    const lines = [header, "-".repeat(header.length)];
    for (const row of rows) {
      lines.push(
        [
          padCell(row.type, widths.type),
          padCell(row.symbol, widths.symbol),
          padCell(row.timeframe, widths.timeframe),
          padCell(row.strategy, widths.strategy),
          padCell(row.price, widths.price),
          padCell(row.timestamp, widths.timestamp),
        ].join(" | "),
      );
    }
    return `<pre>${escapeHtml(lines.join("\n"))}</pre>`;
  }

  function renderSignalsText(title, signals, state) {
    const strategiesById = new Map(
      getStrategies(state).map((item) => [String(item?.id || ""), String(item?.name || item?.id || "Strategy")]),
    );
    if (!signals.length) return `${title}\n\nChưa có tín hiệu phù hợp trong state web hiện tại.`;
    const topSignals = signals.slice(0, 8);
    return `${title}\n\n${renderSignalsTable(topSignals, strategiesById)}`;
  }

  function summarizeScannerSignals(scanner, state) {
    return getSignals(state).filter((signal) => {
      if (scanner?.strategyId && String(signal?.strategyId || "") !== String(scanner.strategyId)) return false;
      if (Array.isArray(scanner?.symbols) && scanner.symbols.length > 0 && !scanner.symbols.includes(signal?.symbol)) return false;
      if (Array.isArray(scanner?.timeframes) && scanner.timeframes.length > 0 && !scanner.timeframes.includes(signal?.timeframe)) return false;
      return true;
    });
  }

  function resolveMatrixCell(scanner, state, symbol, timeframe) {
    const strategyId = String(scanner?.strategyId || "").trim();
    const normalizedSymbol = normalizeSymbol(symbol);
    const normalizedTf = normalizeMatrixTimeframe(timeframe);
    const signals = getSignals(state);
    const virtualPositions = getVirtualPositions(state);

    const latestSignal = signals
      .filter((signal) => {
        if (normalizeSymbol(signal?.symbol) !== normalizedSymbol) return false;
        if (strategyId && String(signal?.strategyId || "").trim() !== strategyId) return false;
        if (signal?.matrixScopeKey) return String(signal.matrixScopeKey) === buildMatrixScopeKey(strategyId, normalizedSymbol, normalizedTf);
        return normalizeMatrixTimeframe(signal?.timeframe) === normalizedTf;
      })
      .sort((a, b) => Number(b?.timestamp || 0) - Number(a?.timestamp || 0))[0];

    let signalType = String(latestSignal?.type || "NO_TRADE").toUpperCase();
    if (signalType !== "BUY" && signalType !== "SELL") signalType = "NO_TRADE";

    const matchingPositions = virtualPositions.filter((position) => {
      if (normalizeSymbol(position?.symbol) !== normalizedSymbol) return false;
      if (strategyId && String(position?.strategyId || "").trim() !== strategyId) return false;
      if (normalizeMatrixTimeframe(position?.timeframe) !== normalizedTf) return false;
      return true;
    });

    const desiredSide = signalType === "BUY" || signalType === "SELL" ? signalType : null;
    const sideMatchedPositions = desiredSide
      ? matchingPositions.filter((position) => String(position?.type || "").toUpperCase() === desiredSide)
      : matchingPositions;
    const positionsForBadge = sideMatchedPositions.length > 0 ? sideMatchedPositions : matchingPositions;

    const openPosition = positionsForBadge.find((position) => String(position?.status || "").toLowerCase() === "open");
    const pendingPosition = positionsForBadge.find((position) => String(position?.status || "").toLowerCase() === "pending");

    if (openPosition) {
      const side = String(openPosition?.type || "").toUpperCase() === "SELL" ? "SELL" : "BUY";
      return side === "SELL" ? "MỞ BÁN" : "MỞ MUA";
    }
    if (pendingPosition) {
      const side = String(pendingPosition?.type || "").toUpperCase() === "SELL" ? "SELL" : "BUY";
      return side === "SELL" ? "CHỜ BÁN" : "CHỜ MUA";
    }
    if (signalType === "BUY") return "SIG MUA";
    if (signalType === "SELL") return "SIG BÁN";
    return "---";
  }

  function renderScannerMatrixText(scanner, state) {
    const strategyMap = new Map(
      getStrategies(state).map((item) => [String(item?.id || ""), String(item?.name || item?.id || "Strategy")]),
    );
    const scannerName = String(scanner?.name || scanner?.id || "Scanner");
    const strategyName = strategyMap.get(String(scanner?.strategyId || "")) || String(scanner?.strategyId || "Chưa chọn");
    const symbols = Array.from(new Set((Array.isArray(scanner?.symbols) ? scanner.symbols : []).map((s) => normalizeSymbol(s)).filter(Boolean))).slice(0, 8);
    const timeframes = Array.from(new Set((Array.isArray(scanner?.timeframes) ? scanner.timeframes : []).map((tf) => normalizeMatrixTimeframe(tf)).filter(Boolean))).slice(0, 5);

    if (!symbols.length || !timeframes.length) {
      return `Scanner: ${escapeHtml(scannerName)}\nStrategy: ${escapeHtml(strategyName)}\n\nChưa có cấu hình symbol/timeframe để hiển thị bảng.`;
    }

    const symbolColWidth = Math.max(7, Math.min(10, Math.max(...symbols.map((s) => s.length), "Mã GD".length)));
    const tfColWidth = 8;
    const lines = [];
    lines.push([padCell("Mã GD", symbolColWidth), ...timeframes.map((tf) => padCell(tf.toUpperCase(), tfColWidth))].join(" | "));
    lines.push("-".repeat(symbolColWidth + (timeframes.length * tfColWidth) + (timeframes.length * 3)));
    for (const symbol of symbols) {
      const row = [padCell(symbol, symbolColWidth)];
      for (const tf of timeframes) {
        row.push(padCell(resolveMatrixCell(scanner, state, symbol, tf), tfColWidth));
      }
      lines.push(row.join(" | "));
    }

    return [
      `Scanner: ${escapeHtml(scannerName)}`,
      `Strategy: ${escapeHtml(strategyName)}`,
      "",
      `<pre>${escapeHtml(lines.join("\n"))}</pre>`,
    ].join("\n");
  }

  function renderScannerMatrixImageUrl(scanner, state) {
    const strategyMap = new Map(
      getStrategies(state).map((item) => [String(item?.id || ""), String(item?.name || item?.id || "Strategy")]),
    );
    const scannerName = String(scanner?.name || scanner?.id || "Scanner");
    const strategyName = strategyMap.get(String(scanner?.strategyId || "")) || String(scanner?.strategyId || "Chua chon");
    const titleText = `${scannerName}`.slice(0, 48);
    const symbols = Array.from(new Set((Array.isArray(scanner?.symbols) ? scanner.symbols : []).map((s) => normalizeSymbol(s)).filter(Boolean))).slice(0, 10);
    const timeframes = Array.from(new Set((Array.isArray(scanner?.timeframes) ? scanner.timeframes : []).map((tf) => normalizeMatrixTimeframe(tf)).filter(Boolean))).slice(0, 8);
    if (!symbols.length || !timeframes.length) return "";

    const headerCells = [`<TD BGCOLOR="#0f172a"><FONT FACE="Arial" POINT-SIZE="13" COLOR="#93c5fd"><B>Mã GD</B></FONT></TD>`]
      .concat(timeframes.map((tf) => `<TD BGCOLOR="#0f172a"><FONT FACE="Arial" POINT-SIZE="13" COLOR="#93c5fd"><B>${escapeDot(tf.toUpperCase())}</B></FONT></TD>`))
      .join("");

    const bodyRows = symbols.map((symbol) => {
      const firstCell = `<TD BGCOLOR="#111827"><FONT FACE="Arial" POINT-SIZE="12" COLOR="#e5e7eb"><B>${escapeDot(symbol)}</B></FONT></TD>`;
      const stateCells = timeframes.map((tf) => {
        const label = resolveMatrixCell(scanner, state, symbol, tf);
        const up = String(label || "").toUpperCase();
        let bg = "#111827";
        let fg = "#d1d5db";
        if (up.includes("MUA")) {
          bg = up.startsWith("MỞ") || up.startsWith("MO ") ? "#064e3b" : "#052e26";
          fg = "#34d399";
        } else if (up.includes("BÁN") || up.includes("BAN")) {
          bg = up.startsWith("MỞ") || up.startsWith("MO ") ? "#4c0519" : "#3f0a1f";
          fg = "#fb7185";
        }
        return `<TD BGCOLOR="${bg}"><FONT FACE="Arial" POINT-SIZE="11" COLOR="${fg}"><B>${escapeDot(label)}</B></FONT></TD>`;
      }).join("");
      return `<TR>${firstCell}${stateCells}</TR>`;
    }).join("");

    const width = Math.min(1400, Math.max(980, 220 + (timeframes.length * 160)));
    const height = Math.min(1200, Math.max(520, 160 + (symbols.length * 120)));

    const dot = `digraph G {
    graph [bgcolor="#020617", pad="0.12", dpi="96", margin="0.02"];
    node [shape=plain];
    table [label=<
      <TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8" COLOR="#0ea5a4">
        <TR><TD COLSPAN="${timeframes.length + 1}" BGCOLOR="#020617"><FONT FACE="Arial" POINT-SIZE="14" COLOR="#e2e8f0"><B>${escapeDot(titleText)}</B></FONT></TD></TR>
        <TR>${headerCells}</TR>
        ${bodyRows}
      </TABLE>
    >];
  }`;

    return `https://quickchart.io/graphviz?format=png&width=${width}&height=${height}&graph=${encodeURIComponent(dot)}`;
  }

  function renderScannerMatrixSvg(scanner, state) {
    const strategyMap = new Map(
      getStrategies(state).map((item) => [String(item?.id || ""), String(item?.name || item?.id || "Strategy")]),
    );
    const scannerName = String(scanner?.name || scanner?.id || "Scanner");
    const strategyName = strategyMap.get(String(scanner?.strategyId || "")) || String(scanner?.strategyId || "Chưa chọn");
    const symbols = Array.from(new Set((Array.isArray(scanner?.symbols) ? scanner.symbols : []).map((s) => normalizeSymbol(s)).filter(Boolean))).slice(0, 12);
    const timeframes = Array.from(new Set((Array.isArray(scanner?.timeframes) ? scanner.timeframes : []).map((tf) => normalizeMatrixTimeframe(tf)).filter(Boolean))).slice(0, 10);
    if (!symbols.length || !timeframes.length) return "";

    const pad = 20;
    const titleH = 56;
    const headH = 56;
    const rowH = 56;
    const firstColW = 220;
    const colW = 150;
    const tableW = firstColW + (timeframes.length * colW);
    const tableH = titleH + headH + (symbols.length * rowH);
    const width = tableW + pad * 2;
    const height = tableH + pad * 2;

    let out = "";
    out += `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    out += `<rect x="0" y="0" width="${width}" height="${height}" fill="#020617"/>`;
    out += `<rect x="${pad}" y="${pad}" width="${tableW}" height="${tableH}" fill="#020617" stroke="#06b6d4" stroke-width="2"/>`;
    out += `<line x1="${pad}" y1="${pad + titleH}" x2="${pad + tableW}" y2="${pad + titleH}" stroke="#06b6d4" stroke-width="2"/>`;
    out += `<text x="${pad + tableW / 2}" y="${pad + 36}" fill="#e2e8f0" font-size="24" text-anchor="middle" font-family="DejaVu Sans" font-weight="700">${escapeXml(scannerName)} | ${escapeXml(strategyName)}</text>`;

    const headY = pad + titleH;
    out += `<rect x="${pad}" y="${headY}" width="${firstColW}" height="${headH}" fill="#0f172a" stroke="#06b6d4" stroke-width="2"/>`;
    out += `<text x="${pad + firstColW / 2}" y="${headY + 36}" fill="#93c5fd" font-size="18" text-anchor="middle" font-family="DejaVu Sans" font-weight="700">Mã GD</text>`;
    for (let i = 0; i < timeframes.length; i += 1) {
      const x = pad + firstColW + i * colW;
      out += `<rect x="${x}" y="${headY}" width="${colW}" height="${headH}" fill="#0f172a" stroke="#06b6d4" stroke-width="2"/>`;
      out += `<text x="${x + colW / 2}" y="${headY + 36}" fill="#93c5fd" font-size="18" text-anchor="middle" font-family="DejaVu Sans" font-weight="700">${escapeXml(timeframes[i].toUpperCase())}</text>`;
    }

    for (let r = 0; r < symbols.length; r += 1) {
      const y = headY + headH + r * rowH;
      const symbol = symbols[r];
      out += `<rect x="${pad}" y="${y}" width="${firstColW}" height="${rowH}" fill="#111827" stroke="#06b6d4" stroke-width="2"/>`;
      out += `<text x="${pad + 18}" y="${y + 37}" fill="#e5e7eb" font-size="16" text-anchor="start" font-family="DejaVu Sans" font-weight="700">${escapeXml(symbol)}</text>`;
      for (let c = 0; c < timeframes.length; c += 1) {
        const tf = timeframes[c];
        const x = pad + firstColW + c * colW;
        const label = resolveMatrixCell(scanner, state, symbol, tf);
        const up = String(label || "").toUpperCase();
        let bg = "#111827";
        let fg = "#d1d5db";
        if (up.includes("MUA")) {
          bg = up.startsWith("MỞ") || up.startsWith("MO ") ? "#064e3b" : "#052e26";
          fg = "#34d399";
        } else if (up.includes("BÁN") || up.includes("BAN")) {
          bg = up.startsWith("MỞ") || up.startsWith("MO ") ? "#4c0519" : "#3f0a1f";
          fg = "#fb7185";
        }
        out += `<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" fill="${bg}" stroke="#06b6d4" stroke-width="2"/>`;
        out += `<text x="${x + colW / 2}" y="${y + 37}" fill="${fg}" font-size="14" text-anchor="middle" font-family="DejaVu Sans" font-weight="700">${escapeXml(label)}</text>`;
      }
    }

    out += `</svg>`;
    return out;
  }

  async function sendScannerMatrixSnapshot(chatId, scanner, state, caption = "") {
    const svg = renderScannerMatrixSvg(scanner, state);
    if (svg) {
      try {
        const sharpModule = await import("sharp");
        const sharp = sharpModule?.default || sharpModule;
        if (typeof sharp === "function") {
          const pngBuffer = await sharp(Buffer.from(svg, "utf8"))
            .png({ compressionLevel: 9, adaptiveFiltering: true, quality: 95 })
            .toBuffer();
          const pngUpload = await sendTelegramPhotoBuffer({
            chatId,
            filename: `scanner-${String(scanner?.id || "snapshot")}.png`,
            buffer: pngBuffer,
            mimeType: "image/png",
            caption: caption || `Snapshot scanner: ${scanner?.name || scanner?.id || "Scanner"}`,
            parseMode: "",
          });
          if (pngUpload?.ok) return pngUpload;
        }
      } catch {
        // Fall back to SVG document / Graphviz URL when local rasterization is unavailable.
      }

      const svgUpload = await sendTelegramDocumentBuffer({
        chatId,
        filename: `scanner-${String(scanner?.id || "snapshot")}.svg`,
        buffer: Buffer.from(svg, "utf8"),
        mimeType: "image/svg+xml",
        caption: caption || `Snapshot scanner: ${scanner?.name || scanner?.id || "Scanner"}`,
        parseMode: "",
      });
      if (svgUpload?.ok) return svgUpload;
    }

    const imageUrl = renderScannerMatrixImageUrl(scanner, state);
    if (!imageUrl) return { ok: false, reason: "no_matrix" };
    const asDocument = await sendTelegramDocument({
      chatId,
      document: imageUrl,
      caption: caption || `Snapshot scanner: ${scanner?.name || scanner?.id || "Scanner"}`,
      parseMode: "",
    });
    if (asDocument?.ok) return asDocument;
    return sendTelegramPhoto({
      chatId,
      photo: imageUrl,
      caption: caption || `Snapshot scanner: ${scanner?.name || scanner?.id || "Scanner"}`,
      parseMode: "",
    });
  }

  return {
    renderSignalsText,
    summarizeScannerSignals,
    renderScannerMatrixText,
    sendScannerMatrixSnapshot,
  };
}
