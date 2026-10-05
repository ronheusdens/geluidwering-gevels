"""Simplified building-acoustics helpers for spectrum instantiation (QC / Studio).

Not normative — validates patterns against catalog clusters and previews stacks.
A-weighted RA remains leading for GA; these produce octave R [dB] at 125–2000 Hz.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable

MANDATORY_HZ = (125, 250, 500, 1000, 2000)
AIR_DENSITY = 1.2  # kg/m³
SOUND_SPEED = 340.0  # m/s


def surface_mass_kg_m2(thickness_mm: float | None, density_kg_m3: float | None) -> float | None:
    if thickness_mm is None or density_kg_m3 is None:
        return None
    if thickness_mm <= 0 or density_kg_m3 <= 0:
        return None
    return density_kg_m3 * (thickness_mm / 1000.0)


def mass_law_r_db(f_hz: float, m_kg_m2: float) -> float:
    """Single homogeneous layer — field incidence mass law (approx)."""
    if m_kg_m2 <= 0 or f_hz <= 0:
        return 0.0
    return 20.0 * math.log10(m_kg_m2 * f_hz) - 47.0


def scale_r_by_thickness_mass_law(
    r_ref: dict[int, float],
    thickness_mm: float,
    thickness_ref_mm: float,
    db_per_double: float = 6.0,
) -> dict[int, float]:
    """Shift all bands when thickness changes (mass doubles → +db_per_double)."""
    if thickness_ref_mm <= 0 or thickness_mm <= 0:
        return dict(r_ref)
    ratio = thickness_mm / thickness_ref_mm
    if ratio <= 0:
        return dict(r_ref)
    delta = db_per_double * math.log2(ratio)
    return {hz: r + delta for hz, r in r_ref.items()}


def msm_resonance_hz(m1: float, m2: float, cavity_m: float) -> float | None:
    """Mass–spring–mass resonant frequency (double leaf)."""
    if m1 <= 0 or m2 <= 0 or cavity_m <= 0:
        return None
    # Effective cavity depth includes end correction (~0.85 per leaf) — simplified.
    d_eff = cavity_m + 0.016
    return (1.0 / (2.0 * math.pi)) * math.sqrt(
        (SOUND_SPEED**2) / (d_eff * (1.0 / m1 + 1.0 / m2))
    )


def msm_double_r_db(
    f_hz: float,
    m_outer: float,
    m_inner: float,
    cavity_mm: float,
    insulation_factor: float = 1.0,
) -> float:
    """Approximate R for double leaf with absorptive cavity (preview only)."""
    if m_outer <= 0 or m_inner <= 0:
        return mass_law_r_db(f_hz, max(m_outer, m_inner))
    cavity_m = max(cavity_mm, 1.0) / 1000.0
    f0 = msm_resonance_hz(m_outer, m_inner, cavity_m) or 200.0
    r_mass = mass_law_r_db(f_hz, m_outer + m_inner)
    # Dip near f0; absorption reduces dip depth.
    dip = 8.0 / insulation_factor
    if f_hz > 0:
        rel = f_hz / f0
        dip *= math.exp(-((math.log10(max(rel, 0.01)) ** 2)) / 0.35)
    return max(r_mass - dip, mass_law_r_db(f_hz, min(m_outer, m_inner)))


@dataclass
class StackLayer:
    label: str
    layer_kind: str
    thickness_mm: float | None = None
    density_kg_m3: float | None = None
    surface_mass_kg_m2: float | None = None
    cavity_depth_mm: float | None = None
    acoustic_role: str = "structural"

    def mass_kg_m2(self) -> float:
        if self.surface_mass_kg_m2 is not None and self.surface_mass_kg_m2 > 0:
            return self.surface_mass_kg_m2
        m = surface_mass_kg_m2(self.thickness_mm, self.density_kg_m3)
        return m or 0.0


def combine_layers_msm(layers: Iterable[StackLayer], hz: int) -> float:
    """HSB-style: outer leaf mass + inner leaf mass + ventilated cavity between."""
    structural = [L for L in layers if L.acoustic_role in ("structural", "lining", "sheathing", "cladding")]
    cavities = [L for L in layers if L.layer_kind == "cavity_ventilated" or L.acoustic_role == "cavity"]
    absorbers = [L for L in layers if L.acoustic_role == "absorptive"]

    if not structural:
        return 0.0

    # Outside-in: first structural cluster = outer leaf, last = inner leaf.
    m_outer = sum(structural[i].mass_kg_m2() for i in range(min(2, len(structural))))
    m_inner = structural[-1].mass_kg_m2() if structural else 0.0
    cavity_mm = 40.0
    if cavities:
        cavity_mm = max((c.cavity_depth_mm or c.thickness_mm or 40.0) for c in cavities)
    ins_factor = 1.0 + 0.15 * sum(a.thickness_mm or 0 for a in absorbers) / 100.0

    return msm_double_r_db(float(hz), m_outer, m_inner, cavity_mm, insulation_factor=ins_factor)


def stack_spectrum_db(layers: Iterable[StackLayer]) -> dict[int, float]:
    return {hz: round(combine_layers_msm(layers, hz), 1) for hz in MANDATORY_HZ}


def approximate_ra_from_r(r_by_hz: dict[int, float]) -> float:
    vals = [r_by_hz[hz] for hz in MANDATORY_HZ if hz in r_by_hz]
    if not vals:
        return 0.0
    return round(sum(vals) / len(vals), 1)
