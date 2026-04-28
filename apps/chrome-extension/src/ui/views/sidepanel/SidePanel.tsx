import { useEffect, useState } from 'react';
import { exampleMessage, tabChange } from '../../../messages';
import { Counter } from '../../components/Counter';
import { useCounter } from '../../components/use-counter';

export function SidePanel() {
  const { count, add, minus } = useCounter();
  const [activeTab, setActiveTab] = useState<{ tabId: number; url: string } | null>(null);

  useEffect(() => {
    exampleMessage.send({ text: 'SidePanel loaded' }).catch(console.error);
  }, []);

  tabChange.useMessageEffect((data) => {
    setActiveTab({ tabId: data.tabId, url: data.url });
  });

  return (
    <main className="mx-auto min-h-screen p-4 text-center">
      <h3 className="my-8 text-2xl leading-5 font-extralight text-cyan-400 uppercase">
        SidePanel Page
      </h3>
      <Counter count={count} onAdd={add} onMinus={minus} />
      <p className="my-4 text-lg">Value: {count}</p>
      {activeTab != null && (
        <div className="my-4 rounded border border-cyan-400/30 bg-cyan-400/5 p-3 text-left text-sm">
          <p className="mb-1 font-semibold text-cyan-400">Active Tab</p>
          <p className="text-gray-300">
            <span className="text-gray-500">ID: </span>
            {activeTab.tabId}
          </p>
          <p className="break-all text-gray-300">
            <span className="text-gray-500">URL: </span>
            {activeTab.url}
          </p>
        </div>
      )}
      <p className="my-2 text-xs text-gray-400">Chrome Extension Template</p>
    </main>
  );
}

export default SidePanel;
