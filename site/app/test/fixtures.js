window.PARITY_CASES = [
 {
  "name": "mock snapshot.json invest_cash",
  "input": {
   "as_of": "2026-10-02",
   "type": "invest_cash",
   "accounts": [
    {
     "id": "MOCK",
     "name": "Mock Taxable",
     "type": "taxable",
     "cash": 250000.0,
     "short_calls": {},
     "positions": []
    }
   ],
   "prices": {
    "SPYM": 90.58,
    "VGT": 128.34,
    "IWM": 281.51,
    "VWO": 59.57
   },
   "weights": {
    "SPYM": 0.4,
    "VGT": 0.35,
    "IWM": 0.2,
    "VWO": 0.05
   },
   "equivalents": {},
   "alt_buy": [],
   "no_buy": [],
   "no_sell": [],
   "no_buy_action": {},
   "gain_limits": {},
   "set_asides": {
    "MOCK": 0
   },
   "cash_target_pct": 0.05,
   "min_cash": 0.0,
   "band": {
    "abs": 0.02,
    "rel": 1.0
   },
   "band_overrides": {},
   "fractional": true,
   "min_trade": 25.0,
   "location": {},
   "sell_unmodeled": false,
   "trade_minimums": {},
   "tax": {
    "block_st": true,
    "near_lt_days": 30,
    "avoid_near_lt": true,
    "lot_method": "min_tax",
    "st_rate": 0.32,
    "lt_rate": 0.15
   }
  },
  "expected": [
   [
    "MOCK",
    "IWM",
    "buy",
    168.7329
   ],
   [
    "MOCK",
    "SPYM",
    "buy",
    1048.7966
   ],
   [
    "MOCK",
    "VGT",
    "buy",
    647.6936
   ],
   [
    "MOCK",
    "VWO",
    "buy",
    199.3453
   ]
  ]
 },
 {
  "name": "mock snapshot_drift.json full",
  "input": {
   "as_of": "2026-10-02",
   "type": "full",
   "accounts": [
    {
     "id": "MOCK",
     "name": "Mock Taxable",
     "type": "taxable",
     "cash": 8468.7,
     "short_calls": {},
     "positions": [
      {
       "symbol": "SPYM",
       "shares": 1300.0,
       "price": 90.58,
       "avg_cost": 74.31,
       "lots": [
        {
         "qty": 800.0,
         "cost": 68.4,
         "acquired": "2023-11-14"
        },
        {
         "qty": 300.0,
         "cost": 79.1,
         "acquired": "2025-08-04"
        },
        {
         "qty": 200.0,
         "cost": 91.95,
         "acquired": "2026-06-22"
        }
       ]
      },
      {
       "symbol": "VGT",
       "shares": 500.0,
       "price": 128.34,
       "avg_cost": 101.2,
       "lots": [
        {
         "qty": 500.0,
         "cost": 101.2,
         "acquired": "2024-02-09"
        }
       ]
      },
      {
       "symbol": "IWM",
       "shares": 180.0,
       "price": 281.51,
       "avg_cost": 262.0,
       "lots": [
        {
         "qty": 180.0,
         "cost": 262.0,
         "acquired": "2025-05-19"
        }
       ]
      },
      {
       "symbol": "VWO",
       "shares": 150.0,
       "price": 59.57,
       "avg_cost": 55.8,
       "lots": [
        {
         "qty": 150.0,
         "cost": 55.8,
         "acquired": "2025-12-01"
        }
       ]
      }
     ]
    }
   ],
   "prices": {
    "SPYM": 90.58,
    "VGT": 128.34,
    "IWM": 281.51,
    "VWO": 59.57
   },
   "weights": {
    "SPYM": 0.4,
    "VGT": 0.35,
    "IWM": 0.2,
    "VWO": 0.05
   },
   "equivalents": {},
   "alt_buy": [],
   "no_buy": [],
   "no_sell": [],
   "no_buy_action": {},
   "gain_limits": {},
   "set_asides": {
    "MOCK": 0
   },
   "cash_target_pct": 0.05,
   "min_cash": 0.0,
   "band": {
    "abs": 0.02,
    "rel": 1.0
   },
   "band_overrides": {},
   "fractional": true,
   "min_trade": 25.0,
   "location": {},
   "sell_unmodeled": false,
   "trade_minimums": {},
   "tax": {
    "block_st": true,
    "near_lt_days": 30,
    "avoid_near_lt": true,
    "lot_method": "min_tax",
    "st_rate": 0.32,
    "lt_rate": 0.15
   }
  },
  "expected": [
   [
    "MOCK",
    "SPYM",
    "sell",
    251.2034
   ],
   [
    "MOCK",
    "VGT",
    "buy",
    145.8836
   ]
  ]
 },
 {
  "name": "mock snapshot_drift.json generate_cash",
  "input": {
   "as_of": "2026-10-02",
   "type": "generate_cash",
   "accounts": [
    {
     "id": "MOCK",
     "name": "Mock Taxable",
     "type": "taxable",
     "cash": 8468.7,
     "short_calls": {},
     "positions": [
      {
       "symbol": "SPYM",
       "shares": 1300.0,
       "price": 90.58,
       "avg_cost": 74.31,
       "lots": [
        {
         "qty": 800.0,
         "cost": 68.4,
         "acquired": "2023-11-14"
        },
        {
         "qty": 300.0,
         "cost": 79.1,
         "acquired": "2025-08-04"
        },
        {
         "qty": 200.0,
         "cost": 91.95,
         "acquired": "2026-06-22"
        }
       ]
      },
      {
       "symbol": "VGT",
       "shares": 500.0,
       "price": 128.34,
       "avg_cost": 101.2,
       "lots": [
        {
         "qty": 500.0,
         "cost": 101.2,
         "acquired": "2024-02-09"
        }
       ]
      },
      {
       "symbol": "IWM",
       "shares": 180.0,
       "price": 281.51,
       "avg_cost": 262.0,
       "lots": [
        {
         "qty": 180.0,
         "cost": 262.0,
         "acquired": "2025-05-19"
        }
       ]
      },
      {
       "symbol": "VWO",
       "shares": 150.0,
       "price": 59.57,
       "avg_cost": 55.8,
       "lots": [
        {
         "qty": 150.0,
         "cost": 55.8,
         "acquired": "2025-12-01"
        }
       ]
      }
     ]
    }
   ],
   "prices": {
    "SPYM": 90.58,
    "VGT": 128.34,
    "IWM": 281.51,
    "VWO": 59.57
   },
   "weights": {
    "SPYM": 0.4,
    "VGT": 0.35,
    "IWM": 0.2,
    "VWO": 0.05
   },
   "equivalents": {},
   "alt_buy": [],
   "no_buy": [],
   "no_sell": [],
   "no_buy_action": {},
   "gain_limits": {},
   "set_asides": {
    "MOCK": 0
   },
   "cash_target_pct": 0.05,
   "min_cash": 0.0,
   "band": {
    "abs": 0.02,
    "rel": 1.0
   },
   "band_overrides": {},
   "fractional": true,
   "min_trade": 25.0,
   "location": {},
   "sell_unmodeled": false,
   "trade_minimums": {},
   "tax": {
    "block_st": true,
    "near_lt_days": 30,
    "avoid_near_lt": true,
    "lot_method": "min_tax",
    "st_rate": 0.32,
    "lt_rate": 0.15
   }
  },
  "expected": [
   [
    "MOCK",
    "SPYM",
    "sell",
    44.5054
   ]
  ]
 },
 {
  "name": "example full",
  "input": {
   "as_of": "2026-10-02",
   "type": "full",
   "accounts": [
    {
     "id": "IND-1",
     "name": "Individual",
     "type": "taxable",
     "cash": 1800.0,
     "short_calls": {
      "AAPL": 1
     },
     "positions": [
      {
       "symbol": "VTI",
       "shares": 120.0,
       "price": 300.0,
       "avg_cost": 252.5,
       "lots": [
        {
         "qty": 60.0,
         "cost": 210.0,
         "acquired": "2023-05-10"
        },
        {
         "qty": 40.0,
         "cost": 280.0,
         "acquired": "2026-04-01"
        },
        {
         "qty": 20.0,
         "cost": 320.0,
         "acquired": "2026-07-15"
        }
       ]
      },
      {
       "symbol": "ITOT",
       "shares": 50.0,
       "price": 130.0,
       "avg_cost": 100.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 100.0,
         "acquired": "2025-10-20"
        }
       ]
      },
      {
       "symbol": "VXUS",
       "shares": 100.0,
       "price": 65.0,
       "avg_cost": 58.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 58.0,
         "acquired": "2024-01-15"
        }
       ]
      },
      {
       "symbol": "AAPL",
       "shares": 100.0,
       "price": 250.0,
       "avg_cost": 150.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 150.0,
         "acquired": "2022-03-01"
        }
       ]
      }
     ]
    },
    {
     "id": "ROTH-1",
     "name": "Roth IRA",
     "type": "roth_ira",
     "cash": 4000.0,
     "short_calls": {},
     "positions": [
      {
       "symbol": "BND",
       "shares": 50.0,
       "price": 73.0,
       "avg_cost": 75.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 75.0,
         "acquired": null
        }
       ]
      },
      {
       "symbol": "QQQM",
       "shares": 20.0,
       "price": 210.0,
       "avg_cost": 180.0,
       "lots": [
        {
         "qty": 20.0,
         "cost": 180.0,
         "acquired": null
        }
       ]
      }
     ]
    }
   ],
   "prices": {
    "VTI": 300.0,
    "ITOT": 130.0,
    "QQQM": 210.0,
    "VXUS": 65.0,
    "BND": 73.0,
    "SCHB": 25.0,
    "AAPL": 250.0
   },
   "weights": {
    "VTI": 0.48,
    "QQQM": 0.12,
    "VXUS": 0.25,
    "BND": 0.15
   },
   "equivalents": {
    "VTI": [
     "ITOT",
     "SCHB"
    ]
   },
   "alt_buy": [
    "ITOT",
    "SCHB"
   ],
   "no_buy": [],
   "no_sell": [],
   "no_buy_action": {},
   "gain_limits": {},
   "set_asides": {
    "IND-1": 3500.0,
    "ROTH-1": 0
   },
   "cash_target_pct": 0.0,
   "min_cash": 50.0,
   "band": {
    "abs": 0.05,
    "rel": 0.25
   },
   "band_overrides": {
    "BND": {
     "abs": 0.03,
     "rel": 0.25
    }
   },
   "fractional": true,
   "min_trade": 25.0,
   "location": {},
   "sell_unmodeled": false,
   "trade_minimums": {},
   "tax": {
    "block_st": true,
    "near_lt_days": 30,
    "avoid_near_lt": true,
    "lot_method": "min_tax",
    "st_rate": 0.32,
    "lt_rate": 0.15
   }
  },
  "expected": [
   [
    "IND-1",
    "BND",
    "buy",
    17.226
   ],
   [
    "IND-1",
    "QQQM",
    "buy",
    13.7429
   ],
   [
    "IND-1",
    "VTI",
    "sell",
    47.1867
   ],
   [
    "IND-1",
    "VXUS",
    "buy",
    127.1154
   ],
   [
    "ROTH-1",
    "BND",
    "buy",
    54.1096
   ]
  ]
 },
 {
  "name": "example sell unmodeled full",
  "input": {
   "as_of": "2026-10-02",
   "type": "full",
   "accounts": [
    {
     "id": "IND-1",
     "name": "Individual",
     "type": "taxable",
     "cash": 1800.0,
     "short_calls": {
      "AAPL": 1
     },
     "positions": [
      {
       "symbol": "VTI",
       "shares": 120.0,
       "price": 300.0,
       "avg_cost": 252.5,
       "lots": [
        {
         "qty": 60.0,
         "cost": 210.0,
         "acquired": "2023-05-10"
        },
        {
         "qty": 40.0,
         "cost": 280.0,
         "acquired": "2026-04-01"
        },
        {
         "qty": 20.0,
         "cost": 320.0,
         "acquired": "2026-07-15"
        }
       ]
      },
      {
       "symbol": "ITOT",
       "shares": 50.0,
       "price": 130.0,
       "avg_cost": 100.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 100.0,
         "acquired": "2025-10-20"
        }
       ]
      },
      {
       "symbol": "VXUS",
       "shares": 100.0,
       "price": 65.0,
       "avg_cost": 58.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 58.0,
         "acquired": "2024-01-15"
        }
       ]
      },
      {
       "symbol": "AAPL",
       "shares": 100.0,
       "price": 250.0,
       "avg_cost": 150.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 150.0,
         "acquired": "2022-03-01"
        }
       ]
      }
     ]
    },
    {
     "id": "ROTH-1",
     "name": "Roth IRA",
     "type": "roth_ira",
     "cash": 4000.0,
     "short_calls": {},
     "positions": [
      {
       "symbol": "BND",
       "shares": 50.0,
       "price": 73.0,
       "avg_cost": 75.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 75.0,
         "acquired": null
        }
       ]
      },
      {
       "symbol": "QQQM",
       "shares": 20.0,
       "price": 210.0,
       "avg_cost": 180.0,
       "lots": [
        {
         "qty": 20.0,
         "cost": 180.0,
         "acquired": null
        }
       ]
      }
     ]
    }
   ],
   "prices": {
    "VTI": 300.0,
    "ITOT": 130.0,
    "QQQM": 210.0,
    "VXUS": 65.0,
    "BND": 73.0,
    "SCHB": 25.0,
    "AAPL": 250.0
   },
   "weights": {
    "VTI": 0.48,
    "QQQM": 0.12,
    "VXUS": 0.25,
    "BND": 0.15
   },
   "equivalents": {
    "VTI": [
     "ITOT",
     "SCHB"
    ]
   },
   "alt_buy": [
    "ITOT",
    "SCHB"
   ],
   "no_buy": [],
   "no_sell": [],
   "no_buy_action": {},
   "gain_limits": {},
   "set_asides": {
    "IND-1": 3500.0,
    "ROTH-1": 0
   },
   "cash_target_pct": 0.0,
   "min_cash": 50.0,
   "band": {
    "abs": 0.05,
    "rel": 0.25
   },
   "band_overrides": {
    "BND": {
     "abs": 0.03,
     "rel": 0.25
    }
   },
   "fractional": true,
   "min_trade": 25.0,
   "location": {},
   "sell_unmodeled": true,
   "trade_minimums": {},
   "tax": {
    "block_st": true,
    "near_lt_days": 30,
    "avoid_near_lt": true,
    "lot_method": "min_tax",
    "st_rate": 0.32,
    "lt_rate": 0.15
   }
  },
  "expected": [
   [
    "IND-1",
    "VTI",
    "sell",
    5.8333
   ],
   [
    "ROTH-1",
    "BND",
    "buy",
    16.5106
   ],
   [
    "ROTH-1",
    "QQQM",
    "buy",
    3.7714
   ],
   [
    "ROTH-1",
    "VXUS",
    "buy",
    30.042
   ]
  ]
 },
 {
  "name": "example sell unmodeled invest_cash",
  "input": {
   "as_of": "2026-10-02",
   "type": "invest_cash",
   "accounts": [
    {
     "id": "IND-1",
     "name": "Individual",
     "type": "taxable",
     "cash": 1800.0,
     "short_calls": {
      "AAPL": 1
     },
     "positions": [
      {
       "symbol": "VTI",
       "shares": 120.0,
       "price": 300.0,
       "avg_cost": 252.5,
       "lots": [
        {
         "qty": 60.0,
         "cost": 210.0,
         "acquired": "2023-05-10"
        },
        {
         "qty": 40.0,
         "cost": 280.0,
         "acquired": "2026-04-01"
        },
        {
         "qty": 20.0,
         "cost": 320.0,
         "acquired": "2026-07-15"
        }
       ]
      },
      {
       "symbol": "ITOT",
       "shares": 50.0,
       "price": 130.0,
       "avg_cost": 100.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 100.0,
         "acquired": "2025-10-20"
        }
       ]
      },
      {
       "symbol": "VXUS",
       "shares": 100.0,
       "price": 65.0,
       "avg_cost": 58.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 58.0,
         "acquired": "2024-01-15"
        }
       ]
      },
      {
       "symbol": "AAPL",
       "shares": 100.0,
       "price": 250.0,
       "avg_cost": 150.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 150.0,
         "acquired": "2022-03-01"
        }
       ]
      }
     ]
    },
    {
     "id": "ROTH-1",
     "name": "Roth IRA",
     "type": "roth_ira",
     "cash": 4000.0,
     "short_calls": {},
     "positions": [
      {
       "symbol": "BND",
       "shares": 50.0,
       "price": 73.0,
       "avg_cost": 75.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 75.0,
         "acquired": null
        }
       ]
      },
      {
       "symbol": "QQQM",
       "shares": 20.0,
       "price": 210.0,
       "avg_cost": 180.0,
       "lots": [
        {
         "qty": 20.0,
         "cost": 180.0,
         "acquired": null
        }
       ]
      }
     ]
    }
   ],
   "prices": {
    "VTI": 300.0,
    "ITOT": 130.0,
    "QQQM": 210.0,
    "VXUS": 65.0,
    "BND": 73.0,
    "SCHB": 25.0,
    "AAPL": 250.0
   },
   "weights": {
    "VTI": 0.48,
    "QQQM": 0.12,
    "VXUS": 0.25,
    "BND": 0.15
   },
   "equivalents": {
    "VTI": [
     "ITOT",
     "SCHB"
    ]
   },
   "alt_buy": [
    "ITOT",
    "SCHB"
   ],
   "no_buy": [],
   "no_sell": [],
   "no_buy_action": {},
   "gain_limits": {},
   "set_asides": {
    "IND-1": 3500.0,
    "ROTH-1": 0
   },
   "cash_target_pct": 0.0,
   "min_cash": 50.0,
   "band": {
    "abs": 0.05,
    "rel": 0.25
   },
   "band_overrides": {
    "BND": {
     "abs": 0.03,
     "rel": 0.25
    }
   },
   "fractional": true,
   "min_trade": 25.0,
   "location": {},
   "sell_unmodeled": true,
   "trade_minimums": {},
   "tax": {
    "block_st": true,
    "near_lt_days": 30,
    "avoid_near_lt": true,
    "lot_method": "min_tax",
    "st_rate": 0.32,
    "lt_rate": 0.15
   }
  },
  "expected": [
   [
    "ROTH-1",
    "BND",
    "buy",
    16.5106
   ],
   [
    "ROTH-1",
    "QQQM",
    "buy",
    3.7714
   ],
   [
    "ROTH-1",
    "VXUS",
    "buy",
    30.042
   ]
  ]
 },
 {
  "name": "example sell unmodeled, no short call, full",
  "input": {
   "as_of": "2026-10-02",
   "type": "full",
   "accounts": [
    {
     "id": "IND-1",
     "name": "Individual",
     "type": "taxable",
     "cash": 1800.0,
     "short_calls": {},
     "positions": [
      {
       "symbol": "VTI",
       "shares": 120.0,
       "price": 300.0,
       "avg_cost": 252.5,
       "lots": [
        {
         "qty": 60.0,
         "cost": 210.0,
         "acquired": "2023-05-10"
        },
        {
         "qty": 40.0,
         "cost": 280.0,
         "acquired": "2026-04-01"
        },
        {
         "qty": 20.0,
         "cost": 320.0,
         "acquired": "2026-07-15"
        }
       ]
      },
      {
       "symbol": "ITOT",
       "shares": 50.0,
       "price": 130.0,
       "avg_cost": 100.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 100.0,
         "acquired": "2025-10-20"
        }
       ]
      },
      {
       "symbol": "VXUS",
       "shares": 100.0,
       "price": 65.0,
       "avg_cost": 58.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 58.0,
         "acquired": "2024-01-15"
        }
       ]
      },
      {
       "symbol": "AAPL",
       "shares": 100.0,
       "price": 250.0,
       "avg_cost": 150.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 150.0,
         "acquired": "2022-03-01"
        }
       ]
      }
     ]
    },
    {
     "id": "ROTH-1",
     "name": "Roth IRA",
     "type": "roth_ira",
     "cash": 4000.0,
     "short_calls": {},
     "positions": [
      {
       "symbol": "BND",
       "shares": 50.0,
       "price": 73.0,
       "avg_cost": 75.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 75.0,
         "acquired": null
        }
       ]
      },
      {
       "symbol": "QQQM",
       "shares": 20.0,
       "price": 210.0,
       "avg_cost": 180.0,
       "lots": [
        {
         "qty": 20.0,
         "cost": 180.0,
         "acquired": null
        }
       ]
      }
     ]
    }
   ],
   "prices": {
    "VTI": 300.0,
    "ITOT": 130.0,
    "QQQM": 210.0,
    "VXUS": 65.0,
    "BND": 73.0,
    "SCHB": 25.0,
    "AAPL": 250.0
   },
   "weights": {
    "VTI": 0.48,
    "QQQM": 0.12,
    "VXUS": 0.25,
    "BND": 0.15
   },
   "equivalents": {
    "VTI": [
     "ITOT",
     "SCHB"
    ]
   },
   "alt_buy": [
    "ITOT",
    "SCHB"
   ],
   "no_buy": [],
   "no_sell": [],
   "no_buy_action": {},
   "gain_limits": {},
   "set_asides": {
    "IND-1": 3500.0,
    "ROTH-1": 0
   },
   "cash_target_pct": 0.0,
   "min_cash": 50.0,
   "band": {
    "abs": 0.05,
    "rel": 0.25
   },
   "band_overrides": {
    "BND": {
     "abs": 0.03,
     "rel": 0.25
    }
   },
   "fractional": true,
   "min_trade": 25.0,
   "location": {},
   "sell_unmodeled": true,
   "trade_minimums": {},
   "tax": {
    "block_st": true,
    "near_lt_days": 30,
    "avoid_near_lt": true,
    "lot_method": "min_tax",
    "st_rate": 0.32,
    "lt_rate": 0.15
   }
  },
  "expected": [
   [
    "IND-1",
    "AAPL",
    "sell",
    100.0
   ],
   [
    "IND-1",
    "BND",
    "buy",
    59.584
   ],
   [
    "IND-1",
    "QQQM",
    "buy",
    25.9701
   ],
   [
    "IND-1",
    "VXUS",
    "buy",
    206.8716
   ],
   [
    "ROTH-1",
    "BND",
    "buy",
    54.1096
   ]
  ]
 },
 {
  "name": "example trade minimums, full",
  "input": {
   "as_of": "2026-10-02",
   "type": "full",
   "accounts": [
    {
     "id": "IND-1",
     "name": "Individual",
     "type": "taxable",
     "cash": 1800.0,
     "short_calls": {},
     "positions": [
      {
       "symbol": "VTI",
       "shares": 120.0,
       "price": 300.0,
       "avg_cost": 252.5,
       "lots": [
        {
         "qty": 60.0,
         "cost": 210.0,
         "acquired": "2023-05-10"
        },
        {
         "qty": 40.0,
         "cost": 280.0,
         "acquired": "2026-04-01"
        },
        {
         "qty": 20.0,
         "cost": 320.0,
         "acquired": "2026-07-15"
        }
       ]
      },
      {
       "symbol": "ITOT",
       "shares": 50.0,
       "price": 130.0,
       "avg_cost": 100.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 100.0,
         "acquired": "2025-10-20"
        }
       ]
      },
      {
       "symbol": "VXUS",
       "shares": 100.0,
       "price": 65.0,
       "avg_cost": 58.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 58.0,
         "acquired": "2024-01-15"
        }
       ]
      },
      {
       "symbol": "AAPL",
       "shares": 100.0,
       "price": 250.0,
       "avg_cost": 150.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 150.0,
         "acquired": "2022-03-01"
        }
       ]
      }
     ]
    },
    {
     "id": "ROTH-1",
     "name": "Roth IRA",
     "type": "roth_ira",
     "cash": 4000.0,
     "short_calls": {},
     "positions": [
      {
       "symbol": "BND",
       "shares": 50.0,
       "price": 73.0,
       "avg_cost": 75.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 75.0,
         "acquired": null
        }
       ]
      },
      {
       "symbol": "QQQM",
       "shares": 20.0,
       "price": 210.0,
       "avg_cost": 180.0,
       "lots": [
        {
         "qty": 20.0,
         "cost": 180.0,
         "acquired": null
        }
       ]
      }
     ]
    }
   ],
   "prices": {
    "VTI": 300.0,
    "ITOT": 130.0,
    "QQQM": 210.0,
    "VXUS": 65.0,
    "BND": 73.0,
    "SCHB": 25.0,
    "AAPL": 250.0
   },
   "weights": {
    "VTI": 0.48,
    "QQQM": 0.12,
    "VXUS": 0.25,
    "BND": 0.15
   },
   "equivalents": {
    "VTI": [
     "ITOT",
     "SCHB"
    ]
   },
   "alt_buy": [
    "ITOT",
    "SCHB"
   ],
   "no_buy": [],
   "no_sell": [],
   "no_buy_action": {},
   "gain_limits": {},
   "set_asides": {
    "IND-1": 3500.0,
    "ROTH-1": 0
   },
   "cash_target_pct": 0.0,
   "min_cash": 50.0,
   "band": {
    "abs": 0.05,
    "rel": 0.25
   },
   "band_overrides": {
    "BND": {
     "abs": 0.03,
     "rel": 0.25
    }
   },
   "fractional": true,
   "min_trade": 25.0,
   "location": {},
   "sell_unmodeled": true,
   "trade_minimums": {
    "QQQM": {
     "buy": 10000.0
    },
    "VTI": {
     "sell": 50000.0
    },
    "BND": {
     "buy": 100.0
    }
   },
   "tax": {
    "block_st": true,
    "near_lt_days": 30,
    "avoid_near_lt": true,
    "lot_method": "min_tax",
    "st_rate": 0.32,
    "lt_rate": 0.15
   }
  },
  "expected": [
   [
    "IND-1",
    "AAPL",
    "sell",
    100.0
   ],
   [
    "IND-1",
    "BND",
    "buy",
    59.584
   ],
   [
    "IND-1",
    "VXUS",
    "buy",
    206.8716
   ],
   [
    "ROTH-1",
    "BND",
    "buy",
    54.1096
   ]
  ]
 },
 {
  "name": "settings full",
  "input": {
   "as_of": "2026-10-02",
   "type": "full",
   "accounts": [
    {
     "id": "MOCK",
     "name": "Mock Taxable",
     "type": "taxable",
     "cash": 8468.7,
     "short_calls": {},
     "positions": [
      {
       "symbol": "SPYM",
       "shares": 1300.0,
       "price": 90.58,
       "avg_cost": 74.31,
       "lots": [
        {
         "qty": 800.0,
         "cost": 68.4,
         "acquired": "2023-11-14"
        },
        {
         "qty": 300.0,
         "cost": 79.1,
         "acquired": "2025-08-04"
        },
        {
         "qty": 200.0,
         "cost": 91.95,
         "acquired": "2026-06-22"
        }
       ]
      },
      {
       "symbol": "VGT",
       "shares": 500.0,
       "price": 128.34,
       "avg_cost": 101.2,
       "lots": [
        {
         "qty": 500.0,
         "cost": 101.2,
         "acquired": "2024-02-09"
        }
       ]
      },
      {
       "symbol": "IWM",
       "shares": 180.0,
       "price": 281.51,
       "avg_cost": 262.0,
       "lots": [
        {
         "qty": 180.0,
         "cost": 262.0,
         "acquired": "2025-05-19"
        }
       ]
      },
      {
       "symbol": "VWO",
       "shares": 150.0,
       "price": 59.57,
       "avg_cost": 55.8,
       "lots": [
        {
         "qty": 150.0,
         "cost": 55.8,
         "acquired": "2025-12-01"
        }
       ]
      }
     ]
    }
   ],
   "prices": {
    "SPYM": 90.58,
    "VGT": 128.34,
    "IWM": 281.51,
    "VWO": 59.57,
    "XLK": 199.85
   },
   "weights": {
    "SPYM": 0.4,
    "VGT": 0.35,
    "IWM": 0.2,
    "VWO": 0.05
   },
   "equivalents": {
    "VGT": [
     "XLK"
    ]
   },
   "alt_buy": [
    "XLK"
   ],
   "no_buy": [
    "VGT"
   ],
   "no_sell": [],
   "no_buy_action": {
    "VGT": "alternative"
   },
   "gain_limits": {
    "*": {
     "short_term": null,
     "long_term": 300.0,
     "total": null
    }
   },
   "set_asides": {
    "MOCK": 5000.0
   },
   "cash_target_pct": 0.05,
   "min_cash": 0.0,
   "band": {
    "abs": 0.02,
    "rel": 1.0
   },
   "band_overrides": {},
   "fractional": true,
   "min_trade": 25.0,
   "location": {},
   "sell_unmodeled": false,
   "trade_minimums": {},
   "tax": {
    "block_st": true,
    "near_lt_days": 30,
    "avoid_near_lt": true,
    "lot_method": "min_tax",
    "st_rate": 0.32,
    "lt_rate": 0.15
   }
  },
  "expected": [
   [
    "MOCK",
    "SPYM",
    "sell",
    226.1324
   ],
   [
    "MOCK",
    "XLK",
    "buy",
    57.3018
   ]
  ]
 },
 {
  "name": "asset location invest_cash",
  "input": {
   "as_of": "2026-10-02",
   "type": "invest_cash",
   "accounts": [
    {
     "id": "IND-1",
     "name": "Individual",
     "type": "taxable",
     "cash": 9000.0,
     "short_calls": {
      "AAPL": 1
     },
     "positions": [
      {
       "symbol": "VTI",
       "shares": 120.0,
       "price": 300.0,
       "avg_cost": 252.5,
       "lots": [
        {
         "qty": 60.0,
         "cost": 210.0,
         "acquired": "2023-05-10"
        },
        {
         "qty": 40.0,
         "cost": 280.0,
         "acquired": "2026-04-01"
        },
        {
         "qty": 20.0,
         "cost": 320.0,
         "acquired": "2026-07-15"
        }
       ]
      },
      {
       "symbol": "ITOT",
       "shares": 50.0,
       "price": 130.0,
       "avg_cost": 100.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 100.0,
         "acquired": "2025-10-20"
        }
       ]
      },
      {
       "symbol": "VXUS",
       "shares": 100.0,
       "price": 65.0,
       "avg_cost": 58.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 58.0,
         "acquired": "2024-01-15"
        }
       ]
      },
      {
       "symbol": "AAPL",
       "shares": 100.0,
       "price": 250.0,
       "avg_cost": 150.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 150.0,
         "acquired": "2022-03-01"
        }
       ]
      }
     ]
    },
    {
     "id": "ROTH-1",
     "name": "Roth IRA",
     "type": "roth_ira",
     "cash": 4000.0,
     "short_calls": {},
     "positions": [
      {
       "symbol": "BND",
       "shares": 50.0,
       "price": 73.0,
       "avg_cost": 75.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 75.0,
         "acquired": null
        }
       ]
      },
      {
       "symbol": "QQQM",
       "shares": 20.0,
       "price": 210.0,
       "avg_cost": 180.0,
       "lots": [
        {
         "qty": 20.0,
         "cost": 180.0,
         "acquired": null
        }
       ]
      }
     ]
    }
   ],
   "prices": {
    "VTI": 300.0,
    "ITOT": 130.0,
    "QQQM": 210.0,
    "VXUS": 65.0,
    "BND": 73.0,
    "SCHB": 25.0,
    "AAPL": 250.0
   },
   "weights": {
    "VTI": 0.48,
    "QQQM": 0.12,
    "VXUS": 0.25,
    "BND": 0.15
   },
   "equivalents": {
    "VTI": [
     "ITOT",
     "SCHB"
    ]
   },
   "alt_buy": [
    "ITOT",
    "SCHB"
   ],
   "no_buy": [],
   "no_sell": [],
   "no_buy_action": {},
   "gain_limits": {},
   "set_asides": {
    "IND-1": 3500.0,
    "ROTH-1": 0
   },
   "cash_target_pct": 0.0,
   "min_cash": 50.0,
   "band": {
    "abs": 0.05,
    "rel": 0.25
   },
   "band_overrides": {
    "BND": {
     "abs": 0.03,
     "rel": 0.25
    }
   },
   "fractional": true,
   "min_trade": 25.0,
   "location": {
    "BND": {
     "taxable": 2,
     "roth_ira": -2
    },
    "VXUS": {
     "roth_ira": 2,
     "taxable": -1
    }
   },
   "sell_unmodeled": false,
   "trade_minimums": {},
   "tax": {
    "block_st": true,
    "near_lt_days": 30,
    "avoid_near_lt": true,
    "lot_method": "min_tax",
    "st_rate": 0.32,
    "lt_rate": 0.15
   }
  },
  "expected": [
   [
    "IND-1",
    "BND",
    "buy",
    40.2798
   ],
   [
    "IND-1",
    "QQQM",
    "buy",
    8.3511
   ],
   [
    "IND-1",
    "VXUS",
    "buy",
    11.6284
   ],
   [
    "ROTH-1",
    "VXUS",
    "buy",
    60.7692
   ]
  ]
 },
 {
  "name": "no asset location invest_cash",
  "input": {
   "as_of": "2026-10-02",
   "type": "invest_cash",
   "accounts": [
    {
     "id": "IND-1",
     "name": "Individual",
     "type": "taxable",
     "cash": 9000.0,
     "short_calls": {
      "AAPL": 1
     },
     "positions": [
      {
       "symbol": "VTI",
       "shares": 120.0,
       "price": 300.0,
       "avg_cost": 252.5,
       "lots": [
        {
         "qty": 60.0,
         "cost": 210.0,
         "acquired": "2023-05-10"
        },
        {
         "qty": 40.0,
         "cost": 280.0,
         "acquired": "2026-04-01"
        },
        {
         "qty": 20.0,
         "cost": 320.0,
         "acquired": "2026-07-15"
        }
       ]
      },
      {
       "symbol": "ITOT",
       "shares": 50.0,
       "price": 130.0,
       "avg_cost": 100.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 100.0,
         "acquired": "2025-10-20"
        }
       ]
      },
      {
       "symbol": "VXUS",
       "shares": 100.0,
       "price": 65.0,
       "avg_cost": 58.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 58.0,
         "acquired": "2024-01-15"
        }
       ]
      },
      {
       "symbol": "AAPL",
       "shares": 100.0,
       "price": 250.0,
       "avg_cost": 150.0,
       "lots": [
        {
         "qty": 100.0,
         "cost": 150.0,
         "acquired": "2022-03-01"
        }
       ]
      }
     ]
    },
    {
     "id": "ROTH-1",
     "name": "Roth IRA",
     "type": "roth_ira",
     "cash": 4000.0,
     "short_calls": {},
     "positions": [
      {
       "symbol": "BND",
       "shares": 50.0,
       "price": 73.0,
       "avg_cost": 75.0,
       "lots": [
        {
         "qty": 50.0,
         "cost": 75.0,
         "acquired": null
        }
       ]
      },
      {
       "symbol": "QQQM",
       "shares": 20.0,
       "price": 210.0,
       "avg_cost": 180.0,
       "lots": [
        {
         "qty": 20.0,
         "cost": 180.0,
         "acquired": null
        }
       ]
      }
     ]
    }
   ],
   "prices": {
    "VTI": 300.0,
    "ITOT": 130.0,
    "QQQM": 210.0,
    "VXUS": 65.0,
    "BND": 73.0,
    "SCHB": 25.0,
    "AAPL": 250.0
   },
   "weights": {
    "VTI": 0.48,
    "QQQM": 0.12,
    "VXUS": 0.25,
    "BND": 0.15
   },
   "equivalents": {
    "VTI": [
     "ITOT",
     "SCHB"
    ]
   },
   "alt_buy": [
    "ITOT",
    "SCHB"
   ],
   "no_buy": [],
   "no_sell": [],
   "no_buy_action": {},
   "gain_limits": {},
   "set_asides": {
    "IND-1": 3500.0,
    "ROTH-1": 0
   },
   "cash_target_pct": 0.0,
   "min_cash": 50.0,
   "band": {
    "abs": 0.05,
    "rel": 0.25
   },
   "band_overrides": {
    "BND": {
     "abs": 0.03,
     "rel": 0.25
    }
   },
   "fractional": true,
   "min_trade": 25.0,
   "location": {},
   "sell_unmodeled": false,
   "trade_minimums": {},
   "tax": {
    "block_st": true,
    "near_lt_days": 30,
    "avoid_near_lt": true,
    "lot_method": "min_tax",
    "st_rate": 0.32,
    "lt_rate": 0.15
   }
  },
  "expected": [
   [
    "IND-1",
    "QQQM",
    "buy",
    3.5436
   ],
   [
    "IND-1",
    "VXUS",
    "buy",
    72.3976
   ],
   [
    "ROTH-1",
    "BND",
    "buy",
    40.2798
   ],
   [
    "ROTH-1",
    "QQQM",
    "buy",
    4.8075
   ]
  ]
 }
];
