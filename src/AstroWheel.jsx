import React, { useState, useRef, useCallback, useEffect } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.25; // per button click
const WHEEL_SENSITIVITY = 0.0015; // gentler, proportional to scroll amount

function clampScale(s) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

// Moved client-side from the old backend matplotlib rendering - same glyphs/colors.
const PLANET_SYMBOLS = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Rahu: "☊", Ketu: "☋",
  Uranus: "♅", Neptune: "♆", Pluto: "♇",
};

const PLANET_COLORS = {
  Sun: "#D35400", Moon: "#6C3483", Mercury: "#1F618D",
  Venus: "#117A65", Mars: "#922B21", Jupiter: "#6C3483",
  Saturn: "#2C3E50", Rahu: "#566573", Ketu: "#5D6D7E",
  Uranus: "#196F3D", Neptune: "#0B5345", Pluto: "#5B2C6F",
};

const ZODIAC_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

const NAKSHATRA_COUNT = 27;
const NAKSHATRA_SPAN = 360 / NAKSHATRA_COUNT; // 13deg20'
const PADA_SPAN = NAKSHATRA_SPAN / 4; // 3deg20'

const CENTER = 50;
const OUTER_R = 48;

// Ascendant-relative polar placement: the Ascendant always lands at the
// fixed left (9 o'clock) screen angle (180deg in this formula), and
// longitude increases counter-clockwise from there - the standard Western/
// Vedic wheel-chart convention. Every ring (signs, nakshatras, houses,
// planets) goes through this single function so there's exactly one place
// angle-to-pixel math lives.
function polarToXY(radius, longitude, ascendantLongitude) {
  const angleDeg = 180 - (longitude - ascendantLongitude);
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(angleRad),
    y: CENTER - radius * Math.sin(angleRad),
  };
}

function normalize360(deg) {
  return ((deg % 360) + 360) % 360;
}

// Builds an SVG path for the annular wedge of one house, spanning from
// `startLon` to `startLon + spanDeg` (always the increasing-longitude
// direction, which is counter-clockwise on screen per polarToXY). Houses
// aren't equal-width under Porphyry/Bhava Madhya, and can exceed 90deg at
// extreme latitudes, so the arc is sampled in small steps rather than
// drawn with a single SVG arc command - this sidesteps large-arc-flag/
// sweep-flag bookkeeping entirely.
function houseWedgePath(point, startLon, spanDeg, innerR, outerR) {
  const steps = Math.max(2, Math.ceil(spanDeg / 3));
  const outerPts = [];
  const innerPts = [];
  for (let i = 0; i <= steps; i++) {
    const lon = startLon + (spanDeg * i) / steps;
    outerPts.push(point(outerR, lon));
    innerPts.push(point(innerR, lon));
  }
  innerPts.reverse();
  const all = [...outerPts, ...innerPts];
  return `M ${all[0].x} ${all[0].y} ` + all.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ") + " Z";
}

// Groups planets that are within `thresholdDeg` of each other (by
// proximity, not naive rounding - two planets a fraction of a degree apart
// on either side of a rounding boundary should still stack together) and
// assigns each a radial offset within its group so they don't overlap.
function stackPlanets(planets, thresholdDeg = 5) {
  const sorted = [...planets].sort((a, b) => a.longitude - b.longitude);
  const groups = [];
  for (const planet of sorted) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup) {
      const lastLon = lastGroup[lastGroup.length - 1].longitude;
      if (normalize360(planet.longitude - lastLon) <= thresholdDeg) {
        lastGroup.push(planet);
        continue;
      }
    }
    groups.push([planet]);
  }
  // Merge first/last group if they wrap around 0/360.
  if (groups.length > 1) {
    const first = groups[0];
    const last = groups[groups.length - 1];
    if (normalize360(first[0].longitude + 360 - last[last.length - 1].longitude) <= thresholdDeg) {
      groups[0] = [...last, ...first];
      groups.pop();
    }
  }

  const result = [];
  for (const group of groups) {
    group.forEach((planet, i) => {
      result.push({ ...planet, stackIndex: i, stackSize: group.length });
    });
  }
  return result;
}

function AstroWheel({ chart, size = 640 }) {
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef(null);

  // Zoom keeping the given viewport-local point (px) anchored in place, so
  // wheel-zoom homes in on the cursor and button-zoom on the viewport centre
  // - the same behaviour OpenSeadragon gives the raster chart.
  const zoomAround = useCallback((factor, anchorX, anchorY) => {
    setScale((prevScale) => {
      const nextScale = clampScale(prevScale * factor);
      const ratio = nextScale / prevScale;
      if (ratio !== 1) {
        setTranslate((prev) => ({
          x: anchorX - (anchorX - prev.x) * ratio,
          y: anchorY - (anchorY - prev.y) * ratio,
        }));
      }
      return nextScale;
    });
  }, []);

  const zoomByButton = useCallback((factor) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    zoomAround(factor, rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0);
  }, [zoomAround]);

  const reset = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    // Exponential factor scaled by the actual scroll delta, so a small
    // trackpad nudge zooms a little and a big wheel spin zooms more -
    // instead of every notch jumping by a fixed multiplier.
    const factor = Math.exp(-e.deltaY * WHEEL_SENSITIVITY);
    zoomAround(factor, e.clientX - rect.left, e.clientY - rect.top);
  }, [zoomAround]);

  const handlePointerDown = useCallback((e) => {
    // Only pan when zoomed in (matches OSD - no drag at home view).
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: translate.x,
      originY: translate.y,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [translate]);

  const handlePointerMove = useCallback((e) => {
    if (!dragState.current) return;
    const { startX, startY, originX, originY } = dragState.current;
    setTranslate({
      x: originX + (e.clientX - startX),
      y: originY + (e.clientY - startY),
    });
  }, []);

  const endDrag = useCallback((e) => {
    dragState.current = null;
    setIsDragging(false);
    e.currentTarget?.releasePointerCapture?.(e.pointerId);
  }, []);

  // Native wheel listeners are passive by default, so preventDefault() from a
  // React onWheel is ignored and the page scrolls instead of zooming. Attach
  // non-passive so wheel-zoom actually captures the gesture.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  if (!chart) return null;

  const ascendantLongitude = chart.houses.ascendant.longitude;
  const cusps = chart.houses.cusps; // house middles (Bhava Madhya)
  const boundaries = chart.houses.boundaries || cusps; // house edges (Bhava Sandhi)
  const stackedPlanets = stackPlanets(chart.planets);

  const point = (radius, longitude) => polarToXY(radius, longitude, ascendantLongitude);

  return (
    <div className="astro-wheel-zoom">
      <div
        ref={viewportRef}
        className="astro-wheel-viewport"
        style={{ cursor: scale > 1 ? "grab" : "default" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="astro-wheel-pan"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            // Smooth easing for button/wheel zoom, but none while dragging so
            // the pan tracks the pointer 1:1 without lag.
            transition: isDragging ? "none" : "transform 0.12s ease-out",
          }}
        >
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className="astro-wheel"
    >
      {/* Opaque background so the wheel reads clearly regardless of the
          page/container behind it (the app has a dark starfield background). */}
      <circle cx={CENTER} cy={CENTER} r={OUTER_R} className="wheel-background" />

      {/* Alternating house-region fills (Bhava Sandhi wedges), so each
          house region is visually distinct at a glance - drawn under
          every other element, over the plain background only. */}
      {boundaries.map((boundary, i) => {
        const nextLon = boundaries[(i + 1) % boundaries.length].longitude;
        const span = normalize360(nextLon - boundary.longitude) || 360;
        const path = houseWedgePath(point, boundary.longitude, span, OUTER_R * 0.15, OUTER_R * 0.78);
        return (
          <path
            key={`house-wedge-${boundary.house}`}
            d={path}
            className={boundary.house % 2 === 0 ? "wheel-house-wedge-even" : "wheel-house-wedge-odd"}
          />
        );
      })}

      {/* Outer boundary rings */}
      <circle cx={CENTER} cy={CENTER} r={OUTER_R} className="wheel-ring-outer" />
      <circle cx={CENTER} cy={CENTER} r={OUTER_R * 0.9} className="wheel-ring-mid" />
      <circle cx={CENTER} cy={CENTER} r={OUTER_R * 0.78} className="wheel-ring-mid" />
      <circle cx={CENTER} cy={CENTER} r={OUTER_R * 0.15} className="wheel-ring-inner" />

      {/* Zodiac sign boundaries + glyphs (outer band, 12 x 30deg) */}
      {Array.from({ length: 12 }, (_, i) => i * 30).map((signStart) => {
        const outer = point(OUTER_R, signStart);
        const inner = point(OUTER_R * 0.9, signStart);
        const labelPos = point(OUTER_R * 0.95, signStart + 15);
        return (
          <React.Fragment key={`sign-${signStart}`}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className="wheel-sign-tick" />
            <text x={labelPos.x} y={labelPos.y} className="wheel-sign-label" textAnchor="middle" dominantBaseline="middle">
              {ZODIAC_GLYPHS[signStart / 30]}
            </text>
          </React.Fragment>
        );
      })}

      {/* Nakshatra + pada ticks (108 x 3deg20', major every 4th) */}
      {Array.from({ length: 108 }, (_, i) => i * PADA_SPAN).map((tickLon, i) => {
        const isNakshatraBoundary = i % 4 === 0;
        const outer = point(OUTER_R * 0.9, tickLon);
        const inner = point(OUTER_R * (isNakshatraBoundary ? 0.78 : 0.84), tickLon);
        return (
          <line
            key={`pada-${i}`}
            x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            className={isNakshatraBoundary ? "wheel-nakshatra-tick-major" : "wheel-nakshatra-tick-minor"}
          />
        );
      })}

      {/* Nakshatra name labels, oriented radially (reading outward along the
          spoke, like the old matplotlib chart) rather than tangentially -
          radial text only needs vertical clearance between neighbors, not
          full label-width clearance, which is what actually fits 27 names
          around the circle without overlapping. */}
      {Array.from({ length: NAKSHATRA_COUNT }, (_, i) => i).map((nakIndex) => {
        const centerLon = nakIndex * NAKSHATRA_SPAN + NAKSHATRA_SPAN / 2;
        const pos = point(OUTER_R * 0.84, centerLon);
        const angleDeg = 180 - (centerLon - ascendantLongitude);
        // Convert from our math-angle convention (CCW-positive) to SVG's
        // rotate() convention (CW-positive), then flip 180deg where needed
        // so the text never renders upside-down.
        let svgRotate = -angleDeg;
        const normalized = normalize360(svgRotate);
        if (normalized > 90 && normalized < 270) svgRotate += 180;
        return (
          <text
            key={`nak-label-${nakIndex}`}
            x={pos.x} y={pos.y}
            className="wheel-nakshatra-label"
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${svgRotate}, ${pos.x}, ${pos.y})`}
          >
            {NAKSHATRA_NAMES[nakIndex]}
          </text>
        );
      })}

      {/* House boundary lines (Bhava Sandhi - midpoint between consecutive
          house middles), spanning from near-center out through the planet
          band to the nakshatra ring - lines crossing behind planets is
          normal/expected in wheel charts. All 12 are drawn the same way -
          the angular houses (1/4/7/10) are NOT bolded here, since under
          Bhava Madhya their boundary edges are not the Asc/MC/Desc/IC
          points (those are the house middles) - see the angle markers
          below for the real angular points. House numbers sit at the house
          MIDDLE (Bhava Madhya), which for house 1 is the Ascendant itself. */}
      {boundaries.map((boundary) => {
        const outer = point(OUTER_R * 0.78, boundary.longitude);
        const inner = point(OUTER_R * 0.15, boundary.longitude);
        return (
          <line
            key={`house-boundary-${boundary.house}`}
            x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            className="wheel-house-line"
          />
        );
      })}
      {cusps.map((cusp) => {
        const numberPos = point(OUTER_R * 0.24, cusp.longitude);
        return (
          <text key={`house-number-${cusp.house}`} x={numberPos.x} y={numberPos.y} className="wheel-house-number" textAnchor="middle" dominantBaseline="middle">
            {cusp.house}
          </text>
        );
      })}

      {/* Bhava Madhya (house middle) dotted lines, one per house - unlabeled,
          same radial span as the boundary lines above, distinguished purely
          by the dashed stroke so the solid boundary vs dotted middle read
          as two different kinds of line at a glance. */}
      {cusps.map((cusp) => {
        const outer = point(OUTER_R * 0.78, cusp.longitude);
        const inner = point(OUTER_R * 0.15, cusp.longitude);
        return (
          <line
            key={`house-madhya-${cusp.house}`}
            x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            className="wheel-house-madhya-line"
          />
        );
      })}

      {/* Asc/MC/Desc/IC - the true angular points, at each's own house
          middle (Bhava Madhya), not the house-boundary edges above. Kept
          subtle (thin muted ticks, small labels in the background) rather
          than bold, since the house grid itself already carries the
          primary visual weight. Ascendant is always at the fixed 9 o'clock
          screen angle by construction (polarToXY is Ascendant-relative). */}
      {[
        { label: "ASC", longitude: chart.houses.ascendant.longitude },
        { label: "DESC", longitude: normalize360(chart.houses.ascendant.longitude + 180) },
        { label: "MC", longitude: chart.houses.midheaven.longitude },
        { label: "IC", longitude: normalize360(chart.houses.midheaven.longitude + 180) },
      ].map((angle) => {
        const outer = point(OUTER_R * 0.78, angle.longitude);
        const inner = point(OUTER_R * 0.15, angle.longitude);
        const labelPos = point(OUTER_R * 0.11, angle.longitude);
        return (
          <React.Fragment key={`angle-${angle.label}`}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className="wheel-angle-marker" />
            <text x={labelPos.x} y={labelPos.y} className="wheel-angle-label" textAnchor="middle" dominantBaseline="middle">
              {angle.label}
            </text>
          </React.Fragment>
        );
      })}

      {/* Planets, stacked when conjunct - given a generous dedicated band
          between the house-number area and the nakshatra ring. A radial
          line runs from the true (unstacked) longitude all the way to
          center, so close conjunctions - where glyphs are stacked at
          different radii to avoid overlapping - still show their exact
          angular position at a glance. */}
      {stackedPlanets.map((planet) => {
        const radius = OUTER_R * (0.68 - planet.stackIndex * 0.11);
        const pos = point(radius, planet.longitude);
        const color = PLANET_COLORS[planet.name] || "#333";
        const degreeLabelPos = point(radius - 3.2, planet.longitude);
        return (
          <g key={planet.name}>
            <line
              x1={CENTER} y1={CENTER} x2={pos.x} y2={pos.y}
              stroke={color}
              className="wheel-planet-line"
            />
            <text
              x={pos.x} y={pos.y}
              fill={color}
              className="wheel-planet-glyph"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {PLANET_SYMBOLS[planet.name] || planet.name[0]}
              {planet.retrograde && <tspan className="wheel-retrograde" dy="-2">℞</tspan>}
            </text>
            <text
              x={degreeLabelPos.x} y={degreeLabelPos.y}
              fill={color}
              className="wheel-planet-degree"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {planet.degree.toFixed(1)}°
            </text>
          </g>
        );
      })}
    </svg>
        </div>
      </div>
      <div className="astro-wheel-controls">
        <button type="button" onClick={() => zoomByButton(ZOOM_STEP)}>Zoom In</button>
        <button type="button" onClick={() => zoomByButton(1 / ZOOM_STEP)}>Zoom Out</button>
        <button type="button" onClick={reset}>Reset</button>
      </div>
    </div>
  );
}

const NAKSHATRA_NAMES = [
  "Ashwini", "Bharani", "Krittika",
  "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha",
  "Magha", "Pu. Phalguni", "U. Phalguni",
  "Hasta", "Chitra", "Swati",
  "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Pu. Ashadha", "U. Ashadha",
  "Shravana", "Dhanishta", "Shatabhisha",
  "Pu. Bhadrapada", "U. Bhadrapada", "Revati",
];

export default AstroWheel;
