import { useState } from 'react';

export function useTimeFilter() {
  const [timeFilter, setTimeFilter] = useState('all');
  return { timeFilter, setTimeFilter };
}
