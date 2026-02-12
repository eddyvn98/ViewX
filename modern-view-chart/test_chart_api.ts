
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { JSDOM } from 'jsdom';

// Mock DOM for lightweight-charts
const dom = new JSDOM('<!DOCTYPE html><div id="chart"></div>');
global.document = dom.window.document as any;
global.window = dom.window as any;
global.HTMLElement = dom.window.HTMLElement as any;

try {
    const container = document.getElementById('chart');
    if (container) {
        const chart = createChart(container);
        const series = chart.addSeries(CandlestickSeries);

        console.log("Series created.");
        console.log("Keys on series:", Object.keys(series));
        console.log("Has setMarkers?", typeof (series as any).setMarkers);

        // Check prototype
        const proto = Object.getPrototypeOf(series);
        console.log("Keys on prototype:", Object.getOwnPropertyNames(proto));

        if (typeof (series as any).setMarkers === 'function') {
            console.log("SUCCESS: setMarkers exists.");
        } else {
            console.error("FAILURE: setMarkers MISSING.");
        }
    }
} catch (e) {
    console.error("Error running test:", e);
}
