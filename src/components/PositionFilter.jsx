import { POSITIONS } from '../core/ranking.js';

export default function PositionFilter({ value, onChange }) {
  return (
    <div className="segmented">
      {['ALL', ...POSITIONS].map((pos) => (
        <button
          key={pos}
          className={`${value === pos ? 'active' : ''} pos-${pos}`}
          onClick={() => onChange(pos)}
        >
          {pos === 'ALL' ? 'All' : pos}
        </button>
      ))}
    </div>
  );
}
