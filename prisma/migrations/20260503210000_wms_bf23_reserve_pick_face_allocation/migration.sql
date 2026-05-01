-- BF-23 — labor/layout-aware greedy allocation (reserve pick-face bins behind bulk).

ALTER TYPE "WmsPickAllocationStrategy" ADD VALUE 'GREEDY_RESERVE_PICK_FACE';
