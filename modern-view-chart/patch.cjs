const fs = require('fs');
const file = 'd:/TradingWeb/BE_ViewChart/modern-view-chart/src/features/strategy/components/StrategyBuilder.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /const \[side, setSide\] = useState<'BUY' \| 'SELL'>\(editingStrategy\?\.side \|\| 'BUY'\);\r?\n\s*const \[entry, setEntry\] = useState<ConditionGroup>\(editingStrategy\?\.entry \|\| \{\r?\n\s*operator: 'AND',\r?\n\s*conditions: \[\{ id: '1', left: \{ type: 'RSI', params: \[14\] \}, comparator: '<', right: 30 \}\]\r?\n\s*\}\);\r?\n\s*const \[exit, setExit\] = useState<ConditionGroup>\(editingStrategy\?\.exit \|\| \{\r?\n\s*operator: 'OR',\r?\n\s*conditions: \[\]\r?\n\s*\}\);/,
    `const [side, setSide] = useState<'BUY' | 'SELL' | 'BOTH'>(editingStrategy?.side || 'BUY');
    const [entry, setEntry] = useState<ConditionGroup>(editingStrategy?.entry || {
        operator: 'AND',
        conditions: [{ id: '1', left: { type: 'RSI', params: [14] }, comparator: '<', right: 30 }]
    });
    const [exit, setExit] = useState<ConditionGroup>(editingStrategy?.exit || {
        operator: 'OR',
        conditions: []
    });

    const [buyEntry, setBuyEntry] = useState<ConditionGroup>(editingStrategy?.buyEntry || {
        operator: 'AND', conditions: [{ id: 'b1', left: { type: 'RSI', params: [14] }, comparator: '<', right: 30 }]
    });
    const [sellEntry, setSellEntry] = useState<ConditionGroup>(editingStrategy?.sellEntry || {
        operator: 'AND', conditions: [{ id: 's1', left: { type: 'RSI', params: [14] }, comparator: '>', right: 70 }]
    });
    const [buyExit, setBuyExit] = useState<ConditionGroup>(editingStrategy?.buyExit || { operator: 'OR', conditions: [] });
    const [sellExit, setSellExit] = useState<ConditionGroup>(editingStrategy?.sellExit || { operator: 'OR', conditions: [] });`
);

content = content.replace(
    /<button\r?\n\s*onClick=\{\(\) => setSide\('SELL'\)\}\r?\n\s*className=\{`flex-1 flex justify-center items-center h-full rounded text-\[8px\] font-black transition-all \$\{side === 'SELL' \? 'bg-red-600 text-white shadow-sm' : 'text-muted-foreground'\}`\}\r?\n\s*>SELL<\/button>/g,
    `<button
                                    onClick={() => setSide('SELL')}
                                    className={\`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all \${side === 'SELL' ? 'bg-red-600 text-white shadow-sm' : 'text-muted-foreground'}\`}
                                >SELL</button>
                                <button
                                    onClick={() => setSide('BOTH')}
                                    className={\`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all \${side === 'BOTH' ? 'bg-purple-600 text-white shadow-sm' : 'text-muted-foreground'}\`}
                                >BOTH</button>`
);

content = content.replace(
    /<RuleBuilder entry=\{entry\} exit=\{exit\} side=\{side\} onChangeEntry=\{setEntry\} onChangeExit=\{setExit\} \/>/g,
    `{side === 'BOTH' ? (
                <div className="flex flex-col gap-3">
                    <RuleBuilder entry={buyEntry} exit={buyExit} side="BUY" onChangeEntry={setBuyEntry} onChangeExit={setBuyExit} />
                    <RuleBuilder entry={sellEntry} exit={sellExit} side="SELL" onChangeEntry={setSellEntry} onChangeExit={setSellExit} />
                </div>
            ) : (
                <RuleBuilder entry={entry} exit={exit} side={side as any} onChangeEntry={setEntry} onChangeExit={setExit} />
            )}`
);

fs.writeFileSync(file, content);
console.log('done');
