"use strict";

// Pixel Mosaic mode — palette and challenge cards, designed as one system.
//
// The palette is exactly 30 colors: 10 hue families across, light / medium / dark
// down. The medium row is the app's original ten colors, so the mode reads as the
// same toy family. Every card is authored in these palette indices only — a cell
// is either "." (empty) or a base-36 digit ("0"-"9", "a"-"t") naming a palette
// slot. No card can ask for a color the child cannot pick, and
// tools/check-pixel-cards.js holds that promise mechanically.
//
// Board: 20 columns x 15 rows (4:3, like the screens it ships on; 300 cells —
// denser than the physical reference toy at the owner's request).
window.PIXEL_CARDS = (() => {
  const palette = [
    // Row 1 — light shades (indices 0-9). Spread wide apart on purpose:
    // the first cut's pastels read as near-duplicates on screen (owner,
    // 2026-08-27: "not different enough, make them more different" — worst
    // pair was light orange vs tan at ΔE 7). Values below keep every pair
    // ≥ ΔE 20 and each family's light→mid→dark step ≥ ΔE 20.
    { name: "light red", value: "#ffb3ab" },     // 0
    { name: "light orange", value: "#ffbb66" },  // 1
    { name: "light yellow", value: "#fff17e" },  // 2
    { name: "light green", value: "#97e79f" },   // 3
    { name: "light teal", value: "#b6f1ea" },    // 4
    { name: "light blue", value: "#a3c9ff" },    // 5
    { name: "light purple", value: "#cbb5ff" },  // 6
    { name: "light pink", value: "#ffcbe3" },    // 7
    { name: "white", value: "#ffffff" },         // 8 — owner, 2026-08-27: the
    // brown family's light step was tan ("light brown"); they asked for
    // "white and brown" instead, so white sits beside brown here and the
    // last column is a light-grey → grey → black ramp (white used to live
    // there and cannot exist twice — the palette keeps 30 distinct colors).
    { name: "light grey", value: "#c8cbd6" },    // 9
    // Row 2 — the app's classic medium colors (indices 10-19), unchanged.
    { name: "red", value: "#f04455" },           // a
    { name: "orange", value: "#ff8a35" },        // b
    { name: "yellow", value: "#ffd93d" },        // c
    { name: "green", value: "#51c86b" },         // d
    { name: "turquoise", value: "#31c8c6" },     // e
    { name: "blue", value: "#3c83ef" },          // f
    { name: "purple", value: "#8257df" },        // g
    { name: "pink", value: "#f46eb3" },          // h
    { name: "brown", value: "#9b623c" },         // i
    { name: "grey", value: "#9a9aa5" },          // j
    // Row 3 — dark shades (indices 20-29), pushed darker and hue-true so
    // each step from the mid row is an obvious jump.
    { name: "dark red", value: "#a81e3c" },      // k
    { name: "dark orange", value: "#c85308" },   // l
    { name: "gold", value: "#c78d0c" },          // m
    { name: "dark green", value: "#1c7a3b" },    // n
    { name: "dark teal", value: "#0d7f7b" },     // o
    { name: "dark blue", value: "#153a8f" },     // p
    { name: "dark purple", value: "#5e2893" },   // q
    { name: "dark pink", value: "#bd2079" },     // r
    { name: "dark brown", value: "#57331d" },    // s
    { name: "black", value: "#30313b" }          // t
  ];

  // Each card: 15 rows of 20 cells. Palette index -> base-36 character.
  const cards = [
    {
      id: "apple",
      name: "the apple",
      rows: [
        "....................",
        ".........ss.........",
        ".........ss.........",
        ".........ssddd......",
        ".........ssdddn.....",
        ".........ss.........",
        "....aaaa..aaaa......",
        "...aa00aa..aaaaa....",
        "..aa000aaaaaaaaa....",
        "..aa00aaaaaaaaaak...",
        "..aa0aaaaaaaaaakk...",
        ".aaaaaaaaaaaaaakk...",
        ".aaaaaaaaaaaaaakk...",
        "..aaaaaaaaaaaakk....",
        ".....aaaaaaakkk....."
      ]
    },
    {
      id: "watermelon",
      name: "the watermelon",
      rows: [
        "....................",
        "....................",
        "........dddd........",
        "......dd3333dd......",
        ".....d33333333d.....",
        "....d3aaaaaaaa3d....",
        "...d3aaaaaaaaaa3d...",
        "..d3aaataaaaaaaa3d..",
        "..d3aaaataaaaaaa3d..",
        ".d3aaaaaataaaaaaa3d.",
        ".d3aaaataaaaataaa3d.",
        ".d3aaaaaataaaaaaa3d.",
        ".d3aaaaaaaaaaaaaa3d.",
        ".dn3aaaaaaaaaaaa3nd.",
        "..dnnnnnnnnnnnnnnd.."
      ]
    },
    {
      id: "strawberry",
      name: "the strawberry",
      rows: [
        "....................",
        "....................",
        ".........ss.........",
        ".....dddddddddd.....",
        ".....dd.dddd.dd.....",
        "......aaaaaaaa......",
        ".....aa2aaa2aa......",
        "....aaa2aaa2aaa.....",
        "....aa2aaaaaa2a.....",
        "....aaaaaaaaaaaak...",
        ".....a2aaaaa2aak....",
        ".....aaaaaaaaak.....",
        "......aa2aaak.......",
        ".......aaak.........",
        "........k..........."
      ]
    },
    {
      id: "heart",
      name: "the heart",
      rows: [
        "....................",
        "....................",
        "....hhh......hhh....",
        "...hhhhh....hhhhh...",
        "..hhhhhhhhhhhhhhhh..",
        "..h7hhhhhhhhhhhhhh..",
        "..h77hhhhhhhhhhhh...",
        "..hhhhhhhhhhhhhhh...",
        "..hhhhhhhhhhhhhrh...",
        "...hhhhhhhhhhhhr....",
        "...hhhhhhhhhhrr.....",
        "....hhhhhhhrr.......",
        ".....hhhhhr.........",
        "......hhr...........",
        ".......h............"
      ]
    },
    {
      id: "rainbow",
      name: "the rainbow",
      rows: [
        "....................",
        "........aaa.........",
        "......aaaaaaa.......",
        "....aaaabbbaaaa.....",
        "...aaabbbbbbbaaa....",
        "...aabbbcccbbbaa....",
        "..aabbcccccccbbaa...",
        "..abbcccdddcccbba...",
        ".aabbccdddddccbbaa..",
        ".abbccddeeeddccbba..",
        ".abbcddeeeeeddcbba..",
        ".abccdeeefeeedccba..",
        "aabccdeefffeedccbaa.",
        "aabcddefffffeddcbaa.",
        "..dddddddddddddddd.."
      ]
    },
    {
      id: "daisy",
      name: "the daisy",
      rows: [
        "....................",
        ".........88.........",
        "........8888........",
        "...88..888888..88...",
        "..8888.888888.8888..",
        "..88888cccccc88888..",
        "..88888cmmmmc88888..",
        "..8888.888888.8888..",
        "...88..888888..88...",
        "........8888........",
        ".........dd.........",
        "...ddd...dd...ddd...",
        "..ddddd..dd..ddddd..",
        "...ddd...dd...ddd...",
        ".........dd........."
      ]
    },
    {
      id: "cat",
      name: "the cat",
      rows: [
        "....................",
        "....................",
        "...bb........bb.....",
        "...b7b......b7b.....",
        "...bbbb....bbbb.....",
        "...bbbbbbbbbbbb.....",
        "...bbbbbbbbbbbb.....",
        "...btbbbbbbbbtb.....",
        "...bbbbbbbbbbbb.....",
        ".jbbb888888bbbj.....",
        ".jbb88rrrr88bbj.....",
        "...bb88888888bb.....",
        "...bbbbbbbbbbbb.....",
        "....bbbbbbbbbb......",
        "...................."
      ]
    },
    {
      id: "fish",
      name: "the fish",
      rows: [
        "....................",
        ".......5............",
        "....55..............",
        "....................",
        ".....eee............",
        "....4444444.........",
        "...4eeeeeee4..ee....",
        "..4eeeeeeeeee.eee...",
        ".eteeeeeeeeeeeeeee..",
        ".oeeeeeeeeeeeeeee...",
        "..oooooooooo.ee.....",
        "....oooooo..........",
        "....................",
        "....................",
        "...................."
      ]
    },
    {
      id: "smile",
      name: "the smile",
      rows: [
        "....................",
        "....................",
        ".......cccc.........",
        ".....cc2ccccc.......",
        "....cc22cccccc......",
        "...cc22cccccccc.....",
        "...cccctcccctcc.....",
        "...cccctcccctcc.....",
        "...cccccccccccc.....",
        "...cctccccccctcc....",
        "...ccctcccccctcc....",
        "....cccttttttccc....",
        ".....cccccccc.......",
        ".......cccc.........",
        "...................."
      ]
    },
    {
      id: "car",
      name: "the car",
      rows: [
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        ".......aaaaaa.......",
        "......a55aa55a......",
        "......a55aa55a......",
        "..aaaaaaaaaaaaaaaa..",
        ".aaaaaaaaaaaaaaaaaa.",
        ".a2aaaaaaaaaaaaaaka.",
        "...ttt......ttt.....",
        "..ttttt....ttttt....",
        "...tjt......tjt.....",
        "...................."
      ]
    },
    {
      id: "rocket",
      name: "the rocket",
      rows: [
        "....................",
        ".........aa.........",
        "........aaaa........",
        "........a88a........",
        "........a88a........",
        "........8ff8........",
        "........8ff8........",
        "........a88a........",
        "........a88a........",
        "......aa8888aa......",
        ".....aa.8888.aa.....",
        ".....a..8888..a.....",
        ".....a..8888..a.....",
        ".......bccccb.......",
        "........bccb........"
      ]
    }
  ];

  return { boardWidth: 20, boardHeight: 15, palette, cards };
})();
