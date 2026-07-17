import React, { useRef, useEffect } from "react";
import OpenSeadragon from "openseadragon";

const ZOOM_STEP = 1.25; // per button click, matches the classic viewer's step

// 1x1 transparent PNG - OSD needs a real "image" tileSource to own the
// viewport/zoom-pan physics, but the actual chart is the SVG overlay below,
// not this pixel. Using OSD's own image viewer (rather than the hand-rolled
// CSS transform + wheel-event zoom used before) is what gives the SVG wheel
// the same spring-physics zoom/pan feel as the classic raster chart.
// IMPORTANT: this must actually decode to a transparent pixel (RGBA with
// alpha 0) - an earlier version of this constant was an opaque black pixel
// (gray+alpha PNG, alpha=255), which OSD scaled up to fill the whole tile,
// showing as a solid black square/ring around the wheel whenever pan/zoom
// exposed the canvas beyond the SVG overlay.
const BLANK_TILE_SOURCE = {
  type: "image",
  url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+p5qgoAAAAABJRU5ErkJggg==",
  buildPyramid: false,
};

// Moved client-side from the old backend matplotlib rendering - same glyphs/colors.
const PLANET_SYMBOLS = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Rahu: "☊", Ketu: "☋",
  Uranus: "♅", Neptune: "♆", Pluto: "♇",
};

const PLANET_ABBR = {
  Sun: "Sun", Moon: "Moo", Mercury: "Mer", Venus: "Ven", Mars: "Mar",
  Jupiter: "Jup", Saturn: "Sat", Rahu: "Rah", Ketu: "Ket",
  Uranus: "Ura", Neptune: "Nep", Pluto: "Plu",
};

const PLANET_COLORS = {
  Sun: "#D35400", Moon: "#6C3483", Mercury: "#1F618D",
  Venus: "#117A65", Mars: "#922B21", Jupiter: "#6C3483",
  Saturn: "#2C3E50", Rahu: "#566573", Ketu: "#5D6D7E",
  Uranus: "#196F3D", Neptune: "#0B5345", Pluto: "#5B2C6F",
};

const ZODIAC_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const ZODIAC_NAMES = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
// 2-letter codes for the Navamsha ring - full names/emoji there would be
// unreadable at 108-slices-around-the-circle density.
const ZODIAC_ABBR = ["Ar", "Ta", "Ge", "Cn", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi"];

const NAKSHATRA_COUNT = 27;
const NAKSHATRA_SPAN = 360 / NAKSHATRA_COUNT; // 13deg20'
const PADA_SPAN = NAKSHATRA_SPAN / 4; // 3deg20'

const CENTER = 50;
const OUTER_R = 48;

// Ring bands, outer to inner, as fractions of OUTER_R. Splitting the old
// single 0.78-0.9 nakshatra band in two makes room for a dedicated Navamsha
// ring alongside it - the house lines/wedges shrink to make space, moving
// their outer edge from 0.78 to HOUSE_R.
const SIGN_R = 0.9; // outer edge of the nakshatra/navamsha bands
const NAV_R = 0.83; // boundary between nakshatra band (outer) and navamsha band (inner)
const HOUSE_R = 0.74; // outer edge of the house-line/wedge band

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

// Navamsha (D9 varga) sign index for a given sidereal longitude. Navamsha
// is not an independent chart - it's each 30deg sign cut into 9 equal
// 3deg20' parts (the same span as a nakshatra pada), each part mapped to a
// zodiac sign. The classical rule (start sign varies by movable/fixed/dual)
// collapses to this single continuous formula: signs simply keep counting
// onward every 9th-of-a-sign around the full zodiac, wrapping mod 12.
function navamshaSignIndex(longitude) {
  const signIndex = Math.floor(longitude / 30);
  const part = Math.floor((longitude % 30) / PADA_SPAN); // 0-8 within the sign
  return (signIndex * 9 + part) % 12;
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
  const osdContainerRef = useRef(null);
  const overlayRef = useRef(null);
  const viewerRef = useRef(null);

  // Own the viewport/zoom-pan physics with a real OpenSeadragon instance -
  // same spring easing/momentum as the classic raster chart - and place the
  // live SVG as an HTML overlay tracking a 1x1 blank placeholder image, so
  // the chart itself stays a real, crisp DOM node rather than a rasterized
  // tile. Mirrors how the classic viewer is set up in App.js.
  useEffect(() => {
    if (!osdContainerRef.current || viewerRef.current) return undefined;

    const viewer = OpenSeadragon({
      element: osdContainerRef.current,
      tileSources: BLANK_TILE_SOURCE,
      showNavigationControl: false,
      showZoomControl: false,
      showHomeControl: false,
      showFullPageControl: false,
      showNavigator: false,
      gestureSettingsMouse: { clickToZoom: false },
      gestureSettingsTouch: { clickToZoom: false },
      visibilityRatio: 1,
      constrainDuringPan: true,
      // maxZoomPixelRatio caps zoom by screen-pixels-per-source-pixel, which
      // makes sense for a real photo but not our 1x1 placeholder - at home
      // zoom we're already showing ~600 screen px for that single source
      // pixel, so a small cap like 8 would clamp zoom-in almost immediately.
      // Bound zoom in viewport-level terms instead (1x = home, 8x = same
      // ceiling the old hand-rolled MAX_SCALE used).
      minZoomLevel: 1,
      maxZoomLevel: 8,
      maxZoomPixelRatio: Infinity,
    });

    viewer.addHandler("open", () => {
      if (overlayRef.current) {
        viewer.addOverlay({
          element: overlayRef.current,
          location: new OpenSeadragon.Rect(0, 0, 1, 1),
        });
      }
    });

    viewerRef.current = viewer;
    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // The container/overlay shell must always mount (even before `chart`
  // arrives) so the OSD-init effect above - which only runs once, on mount -
  // sees a real DOM node. Bailing out with an early `return null` here would
  // leave osdContainerRef permanently null on the first render (chart starts
  // null while the /chart request is in flight), and since that effect's
  // deps are `[]` it would never get a second chance to initialize once the
  // chart data actually arrives.
  const ascendantLongitude = chart?.houses?.ascendant?.longitude ?? 0;
  const cusps = chart?.houses?.cusps ?? []; // house middles (Bhava Madhya)
  const boundaries = chart?.houses?.boundaries ?? cusps; // house edges (Bhava Sandhi)
  const stackedPlanets = chart ? stackPlanets(chart.planets) : [];

  const point = (radius, longitude) => polarToXY(radius, longitude, ascendantLongitude);

  return (
    <div className="astro-wheel-zoom">
      <div ref={osdContainerRef} className="astro-wheel-osd-viewport" style={{ width: size, height: size }} />
      <div ref={overlayRef} className="astro-wheel-overlay">
      {chart && (
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
        const path = houseWedgePath(point, boundary.longitude, span, OUTER_R * 0.15, OUTER_R * HOUSE_R);
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
      <circle cx={CENTER} cy={CENTER} r={OUTER_R * SIGN_R} className="wheel-ring-mid" />
      <circle cx={CENTER} cy={CENTER} r={OUTER_R * NAV_R} className="wheel-ring-mid" />
      <circle cx={CENTER} cy={CENTER} r={OUTER_R * HOUSE_R} className="wheel-ring-mid" />
      <circle cx={CENTER} cy={CENTER} r={OUTER_R * 0.15} className="wheel-ring-inner" />

      {/* Zodiac sign boundaries + glyph+name labels (outer band, 12 x 30deg).
          Oriented tangentially (same technique as the nakshatra ring) since
          "♈ Aries" is too wide to sit horizontally near the top/bottom of
          the circle without overlapping its neighbors. */}
      {Array.from({ length: 12 }, (_, i) => i * 30).map((signStart) => {
        const outer = point(OUTER_R, signStart);
        const inner = point(OUTER_R * SIGN_R, signStart);
        const centerLon = signStart + 15;
        const labelPos = point(OUTER_R * 0.95, centerLon);
        const angleDeg = 180 - (centerLon - ascendantLongitude);
        let svgRotate = -angleDeg + 90;
        const normalized = normalize360(svgRotate);
        if (normalized > 90 && normalized < 270) svgRotate += 180;
        return (
          <React.Fragment key={`sign-${signStart}`}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className="wheel-sign-tick" />
            <text
              x={labelPos.x} y={labelPos.y}
              className="wheel-sign-label"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${svgRotate}, ${labelPos.x}, ${labelPos.y})`}
            >
              {ZODIAC_GLYPHS[signStart / 30]} {ZODIAC_NAMES[signStart / 30]}
            </text>
          </React.Fragment>
        );
      })}

      {/* Nakshatra + pada ticks (108 x 3deg20', major every 4th) */}
      {Array.from({ length: 108 }, (_, i) => i * PADA_SPAN).map((tickLon, i) => {
        const isNakshatraBoundary = i % 4 === 0;
        const outer = point(OUTER_R * SIGN_R, tickLon);
        const inner = point(OUTER_R * (isNakshatraBoundary ? NAV_R : 0.865), tickLon);
        return (
          <line
            key={`pada-${i}`}
            x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            className={isNakshatraBoundary ? "wheel-nakshatra-tick-major" : "wheel-nakshatra-tick-minor"}
          />
        );
      })}

      {/* Nakshatra name labels, oriented tangentially (running along the
          circumference, like the ring of a real chart wheel) rather than
          radially - the old radial orientation made full names ("Pu.
          Bhadrapada") stick out past the band into the neighboring rings.
          Tangential text only needs the band's own width for its
          font-size, and short-form abbreviations (the standard 3-4 letter
          codes) keep every label comfortably within its 13.33deg slice;
          the full name is still available on hover via <title>. */}
      {Array.from({ length: NAKSHATRA_COUNT }, (_, i) => i).map((nakIndex) => {
        const centerLon = nakIndex * NAKSHATRA_SPAN + NAKSHATRA_SPAN / 2;
        const pos = point(OUTER_R * ((SIGN_R + NAV_R) / 2), centerLon);
        const angleDeg = 180 - (centerLon - ascendantLongitude);
        // Convert from our math-angle convention (CCW-positive) to SVG's
        // rotate() convention (CW-positive); tangential text reads along
        // the circle so it needs a +90deg offset from the radial angle,
        // plus the same upside-down flip check as before.
        let svgRotate = -angleDeg + 90;
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
            <title>{NAKSHATRA_NAMES[nakIndex]}</title>
            {NAKSHATRA_ABBR[nakIndex]}
          </text>
        );
      })}

      {/* Navamsha (D9) ring - each 3deg20' pada-width slice labeled with the
          2-letter code of the sign that slice falls into under the D9
          subdivision. Same tick positions as the nakshatra ring above (the
          spans coincide exactly), just one band further in. Plain 2-letter
          text rather than the zodiac emoji glyphs - at 108-around-the-circle
          density the glyphs read as visual noise/too similar to each other. */}
      {Array.from({ length: 108 }, (_, i) => i * PADA_SPAN).map((tickLon, i) => {
        const isNakshatraBoundary = i % 4 === 0;
        const outer = point(OUTER_R * NAV_R, tickLon);
        const inner = point(OUTER_R * (isNakshatraBoundary ? HOUSE_R : 0.775), tickLon);
        return (
          <line
            key={`navamsha-tick-${i}`}
            x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            className={isNakshatraBoundary ? "wheel-navamsha-tick-major" : "wheel-navamsha-tick-minor"}
          />
        );
      })}
      {Array.from({ length: 108 }, (_, i) => i).map((i) => {
        const centerLon = i * PADA_SPAN + PADA_SPAN / 2;
        const pos = point(OUTER_R * ((NAV_R + HOUSE_R) / 2), centerLon);
        return (
          <text
            key={`navamsha-label-${i}`}
            x={pos.x} y={pos.y}
            className="wheel-navamsha-label"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {ZODIAC_ABBR[navamshaSignIndex(centerLon)]}
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
        const outer = point(OUTER_R * HOUSE_R, boundary.longitude);
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
        const outer = point(OUTER_R * HOUSE_R, cusp.longitude);
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
        const outer = point(OUTER_R * HOUSE_R, angle.longitude);
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
        const radius = OUTER_R * (0.68 - planet.stackIndex * 0.14);
        const pos = point(radius, planet.longitude);
        const color = PLANET_COLORS[planet.name] || "#333";
        const nameLabelPos = point(radius - 2.4, planet.longitude);
        const degreeLabelPos = point(radius - 4.6, planet.longitude);
        // Tangential orientation (running along the circumference) for the
        // name, same technique as the sign/nakshatra rings, rather than
        // stacked radially under the glyph - reads more like a wheel-chart
        // label and needs less vertical room per stacked planet.
        const nameAngleDeg = 180 - (planet.longitude - ascendantLongitude);
        let nameSvgRotate = -nameAngleDeg + 90;
        const nameNormalized = normalize360(nameSvgRotate);
        if (nameNormalized > 90 && nameNormalized < 270) nameSvgRotate += 180;
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
              x={nameLabelPos.x} y={nameLabelPos.y}
              fill={color}
              className="wheel-planet-name"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${nameSvgRotate}, ${nameLabelPos.x}, ${nameLabelPos.y})`}
            >
              {PLANET_ABBR[planet.name] || planet.name.slice(0, 3)}
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
      )}
      </div>
      <div className="astro-wheel-controls">
        <button type="button" onClick={() => viewerRef.current?.viewport.zoomBy(ZOOM_STEP).applyConstraints()}>Zoom In</button>
        <button type="button" onClick={() => viewerRef.current?.viewport.zoomBy(1 / ZOOM_STEP).applyConstraints()}>Zoom Out</button>
        <button type="button" onClick={() => viewerRef.current?.viewport.goHome()}>Reset</button>
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

// Standard short-form codes, used on the wheel itself since the full names
// don't fit in the ring's tangential slice at a legible font size.
const NAKSHATRA_ABBR = [
  "Ash", "Bha", "Kri",
  "Roh", "Mrg", "Ard",
  "Pun", "Pus", "Asl",
  "Mag", "PPh", "UPh",
  "Has", "Chi", "Swa",
  "Vis", "Anu", "Jye",
  "Mul", "PAs", "UAs",
  "Shr", "Dha", "Sha",
  "PBh", "UBh", "Rev",
];

export default AstroWheel;
