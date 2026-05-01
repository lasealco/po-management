-- BF-34 — Opt-in MILP-style prototype (exact minimal slot-cardinality subset + BF-15 / BF-23 ordering).

ALTER TYPE "WmsPickAllocationStrategy" ADD VALUE 'SOLVER_PROTOTYPE_MIN_BIN_TOUCHES';
ALTER TYPE "WmsPickAllocationStrategy" ADD VALUE 'SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE';
