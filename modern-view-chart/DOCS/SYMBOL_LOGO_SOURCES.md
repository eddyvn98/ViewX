# Symbol Logo Sources

This document tracks the source and usage rights for local symbol logos in:
- `public/symbol-logos/*.svg`

## License policy
- All files in `public/symbol-logos/` are local assets created for runtime stability.
- Assets are either:
  - custom in-repo SVG badges based on public visual conventions, or
  - adapted from free/open icon references.
- Equity batch pack in `public/symbol-logos/equity/` is sourced by script:
  - First preference: Simple Icons SVG (CC0 source package).
  - Fallback: Financial Modeling Prep stock image endpoint (`image-stock/{TICKER}.png`) for tickers without Simple Icons slug mapping.
- Current pack is intended for internal app UI usage in this project.

## Asset list

| File | Symbol group | Source type | License note | Attribution required |
|---|---|---|---|---|
| `btc.svg` | BTC pairs | Custom local SVG (bitcoin-style mark) | In-repo custom asset | No |
| `eth.svg` | ETH pairs | Custom local SVG (ethereum-style diamond) | In-repo custom asset | No |
| `aapl.svg`, `aapl-light.svg`, `aapl-dark.svg` | AAPL | Simple Icons (`apple`) + local light/dark variants | CC0 source package, trademark belongs to owner | No |
| `nvda.svg`, `nvda-light.svg`, `nvda-dark.svg` | NVDA | Simple Icons (`nvidia`) + local light/dark variants | CC0 source package, trademark belongs to owner | No |
| `amzn.svg`, `amzn-light.svg`, `amzn-dark.svg` | AMZN | Simple Icons (`amazon`) + local light/dark variants | CC0 source package, trademark belongs to owner | No |
| `adbe.svg`, `amd.svg`, `avgo.svg`, `ba.svg`, `baba.svg`, `bac.svg`, `bidu.svg`, `bili.svg`, `csco.svg`, `f.svg`, `googl.svg`, `ibm.svg`, `intc.svg`, `ko.svg`, `ma.svg`, `mcd.svg`, `meta.svg`, `mrk.svg`, `msft.svg`, `nflx.svg`, `nke.svg`, `orcl.svg`, `pep.svg`, `pypl.svg`, `sbux.svg`, `t.svg`, `tmus.svg`, `tsla.svg`, `v.svg`, `vz.svg`, `wmt.svg` | Equity symbols | Simple Icons (matching brand slugs) | CC0 source package, trademark belongs to owner | No |
| `xau.svg` | Gold symbols | Custom local SVG | In-repo custom asset | No |
| `xag.svg` | Silver symbols | Custom local SVG | In-repo custom asset | No |
| `eur.svg` | Forex base/quote | Custom local SVG badge | In-repo custom asset | No |
| `usd.svg` | Forex base/quote | Custom local SVG badge | In-repo custom asset | No |
| `jpy.svg` | Forex base/quote | Custom local SVG badge | In-repo custom asset | No |
| `gbp.svg` | Forex base/quote | Custom local SVG badge | In-repo custom asset | No |
| `aud.svg` | Forex base/quote | Custom local SVG badge | In-repo custom asset | No |
| `nzd.svg` | Forex base/quote | Custom local SVG badge | In-repo custom asset | No |
| `cad.svg` | Forex base/quote | Custom local SVG badge | In-repo custom asset | No |
| `chf.svg` | Forex base/quote | Custom local SVG badge | In-repo custom asset | No |
| `us30.svg` | Index CFD | Custom local SVG badge | In-repo custom asset | No |
| `nas100.svg` | Index CFD | Custom local SVG badge | In-repo custom asset | No |
| `ger40.svg` | Index CFD | Custom local SVG badge | In-repo custom asset | No |
| `uk100.svg` | Index CFD | Custom local SVG badge | In-repo custom asset | No |
| `wti.svg` | Commodity CFD | Custom local SVG badge | In-repo custom asset | No |
| `brent.svg` | Commodity CFD | Custom local SVG badge | In-repo custom asset | No |

## Review checklist for future additions
- Use SVG when possible.
- Keep icon contrast acceptable in light and dark themes.
- Prefer local files over CDN/hotlink.
- Update this file whenever a new logo is added.
- Re-run `node scripts/symbol-logos/fetch-equity-logos.mjs mt5_symbols_live.txt` after MT5 symbol list changes.
