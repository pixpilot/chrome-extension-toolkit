interface CounterProps {
  count: number;
  onAdd: () => void;
  onMinus: () => void;
}

export function Counter({ count, onAdd, onMinus }: CounterProps) {
  return (
    <div className="my-8 flex items-center justify-center">
      <button
        type="button"
        onClick={onMinus}
        disabled={count <= 0}
        className="mx-0 w-12 cursor-pointer rounded border border-cyan-400 bg-transparent px-4 py-2 text-base text-cyan-400 outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        -
      </button>
      <span className="mx-4 text-2xl">{count}</span>
      <button
        type="button"
        onClick={onAdd}
        className="mx-0 w-12 cursor-pointer rounded border border-cyan-400 bg-transparent px-4 py-2 text-base text-cyan-400 outline-none"
      >
        +
      </button>
    </div>
  );
}

export default Counter;
