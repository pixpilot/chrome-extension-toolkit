import { useEffect } from 'react';
import { exampleMessage } from '../../../messages';
import { Counter } from '../../components/Counter';
import { useCounter } from '../../components/use-counter';

export function Options() {
  const { count, add, minus } = useCounter();

  useEffect(() => {
    exampleMessage.send({ text: 'Options loaded' }).catch(console.error);
  }, []);

  return (
    <main className="mx-auto min-h-screen min-w-80 p-4 text-center">
      <h3 className="my-8 text-2xl leading-5 font-extralight text-cyan-400 uppercase">
        Options Page
      </h3>
      <Counter count={count} onAdd={add} onMinus={minus} />
      <p className="my-4 text-lg">Value: {count}</p>
      <p className="my-2 text-xs text-gray-400">Chrome Extension Template</p>
    </main>
  );
}

export default Options;
